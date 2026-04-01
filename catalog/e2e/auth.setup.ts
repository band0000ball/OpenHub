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
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    setup.skip(true, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定のためスキップ");
    return;
  }

  // /login にアクセス → Cognito Hosted UI へリダイレクト
  await page.goto("/login");

  // Cognito ドメインへのリダイレクトを待機（最大 30 秒）
  await page.waitForURL(/cognito.*\.amazoncognito\.com/, { timeout: 30000 });

  // Cognito Hosted UI でサインイン
  await page.locator('input[name="username"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="signInSubmitButton"]').click();

  // /settings への到達を確認（最大 30 秒）
  await page.waitForURL(/\/settings/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/settings/);

  // セッションを保存
  await page.context().storageState({ path: authStatePath });
});
