import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const authStatePath = path.join(process.cwd(), ".auth/state.json");

/**
 * 認証セットアップ
 *
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD が設定されていない場合はスキップする。
 * 設定済みの場合は Cognito Hosted UI でサインインし、
 * storageState を .auth/state.json に保存する。
 *
 * 2 つのケースを処理する:
 * A) 新規ログイン: /settings → Cognito UI → 認証情報入力 → /settings
 * B) 自動ログイン: /settings → (Cognito セッション既存で自動完了) → /settings
 *    リトライ時や AWS 環境で Cognito セッションが残っている場合に発生する
 */
setup("Cognito 認証セットアップ", async ({ page }) => {
  // Cognito との複数回のネットワーク往復があるため timeout を延長する
  setup.setTimeout(120000);

  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    setup.skip(true, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定のためスキップ");
    return;
  }

  // 古いセッション state を削除
  try { fs.unlinkSync(authStatePath); } catch { /* not found — OK */ }

  // /settings にアクセス → proxy.ts が /login へリダイレクト → Cognito へ
  await page.goto("/settings");

  // Cognito UI に到達するか、自動ログインで /settings に直接到達するかを待機
  // どちらかが先に発生した方で分岐する
  const destination = await Promise.race([
    page.waitForURL(/amazoncognito\.com/, { timeout: 60000 }).then(() => "cognito" as const),
    page.waitForURL(/\/settings/, { timeout: 60000 }).then(() => "settings" as const),
  ]);

  if (destination === "settings") {
    // ケース B: 自動ログイン完了 — Cognito セッションが既に存在していた
    // /settings に到達済みなのでセッションを保存するだけ
    await expect(page).toHaveURL(/\/settings/);
    await page.context().storageState({ path: authStatePath });
    return;
  }

  // ケース A: Cognito UI に到達 — 認証情報を入力する
  await page.locator('input[name="username"]').fill(email);
  await page.locator('button[type="submit"]').click();

  // パスワード入力ページを待機
  const challengePage = page.locator('button:has-text("Password"), input[name="password"]');
  await challengePage.first().waitFor({ timeout: 15000 });
  if (await page.locator('button:has-text("Password")').isVisible()) {
    await page.locator('button:has-text("Password")').click();
  }

  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // 初回ログイン時の「Change password」チャレンジ
  const changePasswordHeading = page.getByRole("heading", { name: "Change password" });
  try {
    await changePasswordHeading.waitFor({ timeout: 30000 });
    await page.locator('input[placeholder="Enter new password"]').fill(password);
    await page.locator('input[placeholder="Re-enter new password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/(?!.*amazoncognito\.com.*changepassword).*/, { timeout: 30000 });
  } catch {
    // Change password チャレンジが出なければそのまま続行
  }

  // パスキー登録プロンプトのスキップ
  try {
    await page.waitForURL(/login\/complete/, { timeout: 5000 });
    const notNow = page.locator('button:has-text("Not now"), button:has-text("Skip")');
    if (await notNow.first().isVisible()) {
      await notNow.first().click();
    }
  } catch {
    // /login/complete が出なければそのまま続行
  }

  // /settings への到達を確認
  await page.waitForURL(/\/settings/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/settings/);

  // セッションを保存
  await page.context().storageState({ path: authStatePath });
});
