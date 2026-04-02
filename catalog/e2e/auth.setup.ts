import { test as setup, expect } from "@playwright/test";
import path from "path";

const authStatePath = path.join(process.cwd(), ".auth/state.json");

/**
 * 認証セットアップ
 *
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD が設定されていない場合はスキップする。
 * 設定済みの場合は Cognito Hosted UI でサインインし、
 * storageState を .auth/state.json に保存する。
 *
 * Cognito Hosted UI のセレクター（外部サービス依存）:
 *   - ユーザー名: input[name="username"]
 *   - パスワード: input[name="password"]
 *   - サインインボタン: input[name="signInSubmitButton"]
 * Cognito UI が変更された場合はこのファイルのセレクターを更新する。
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

  // /settings にアクセス → middleware が /login へ、/login が Cognito へリダイレクト
  // これにより callbackUrl が /settings に設定される
  await page.goto("/settings");

  // Cognito ドメインへのリダイレクトを待機（最大 30 秒）
  // 実際のドメインは "ap-northeast-1hk1xd4doz.auth.ap-northeast-1.amazoncognito.com" 形式
  await page.waitForURL(/amazoncognito\.com/, { timeout: 30000 });

  // Cognito Hosted UI でサインイン（ステップ式: username → Next → password）
  await page.locator('input[name="username"]').fill(email);
  // "Next" ボタンをクリック（username ステップ）
  await page.locator('button[type="submit"]').click();

  // パスワード入力ページを待機（verifyPassword または availableChallenges）
  // "available challenges" が出る場合は Password を選択する
  const challengePage = page.locator('button:has-text("Password"), input[name="password"]');
  await challengePage.first().waitFor({ timeout: 15000 });
  if (await page.locator('button:has-text("Password")').isVisible()) {
    await page.locator('button:has-text("Password")').click();
  }

  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // 初回ログイン時の「Change password」チャレンジ（FORCE_CHANGE_PASSWORD 状態）をハンドル
  // 30 秒待機してチャレンジが出るかを確認する
  const changePasswordHeading = page.getByRole("heading", { name: "Change password" });
  try {
    await changePasswordHeading.waitFor({ timeout: 30000 });
    // チャレンジが出たら新パスワードを入力して送信
    await page.locator('input[placeholder="Enter new password"]').fill(password);
    await page.locator('input[placeholder="Re-enter new password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    // 送信後のナビゲーションを待機（Change password 以外のページへ移動するまで）
    await page.waitForURL(/(?!.*amazoncognito\.com.*changepassword).*/, { timeout: 30000 });
  } catch {
    // Change password チャレンジが出なければそのまま続行
  }

  // パスキー登録プロンプト（/login/complete）が出る場合は "Not now" でスキップ
  try {
    await page.waitForURL(/login\/complete/, { timeout: 5000 });
    const notNow = page.locator('button:has-text("Not now"), button:has-text("Skip")');
    if (await notNow.first().isVisible()) {
      await notNow.first().click();
    }
  } catch {
    // /login/complete が出なければそのまま続行
  }

  // /settings への到達を確認（最大 30 秒）
  await page.waitForURL(/\/settings/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/settings/);

  // セッションを保存
  await page.context().storageState({ path: authStatePath });
});
