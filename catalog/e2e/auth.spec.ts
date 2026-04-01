import { test, expect } from "@playwright/test";

/**
 * 認証フローの E2E テスト
 *
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定の場合は全テストをスキップする。
 * Cognito Hosted UI への依存があるため、外部ネットワークが必要。
 *
 * Cognito Hosted UI セレクター（外部サービス依存）:
 *   input[name="username"] / input[name="password"] / input[name="signInSubmitButton"]
 * Cognito UI が変更された場合は auth.setup.ts とこのファイルのセレクターを更新する。
 */

test.describe("Authentication flow", () => {
  test.beforeEach(() => {
    if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
      test.skip(true, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定のためスキップ");
    }
  });

  test("/login → Cognito サインイン → /settings に到達する", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;

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

    // 設定ページの見出しが表示されている
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("サインイン後に /settings ページの設定フォームが表示される", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;

    await page.goto("/login");
    await page.waitForURL(/cognito.*\.amazoncognito\.com/, { timeout: 30000 });

    await page.locator('input[name="username"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="signInSubmitButton"]').click();

    await page.waitForURL(/\/settings/, { timeout: 30000 });

    // アプリケーションID 入力欄が表示されている
    await expect(page.getByLabel(/アプリケーションID/i)).toBeVisible();
  });
});
