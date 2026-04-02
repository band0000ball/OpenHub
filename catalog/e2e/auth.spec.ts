import { test, expect } from "@playwright/test";

/**
 * 認証フローの E2E テスト
 *
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定の場合は全テストをスキップする。
 * Cognito Hosted UI への依存があるため、外部ネットワークが必要。
 *
 * Cognito Hosted UI セレクター（外部サービス依存）:
 *   - ユーザー名: input[name="username"]
 *   - "Next" ボタン: button[type="submit"]
 *   - パスワード選択（challenge ページ）: button:has-text("Password")
 *   - パスワード入力: input[name="password"]
 *   - パスキースキップ: button:has-text("Not now")
 * Cognito UI が変更された場合は auth.setup.ts とこのファイルのセレクターを更新する。
 */

async function signInWithCognito(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  // /settings にアクセス → middleware が /login へ、/login が Cognito へリダイレクト
  // これにより callbackUrl が /settings に設定される
  await page.goto("/settings");

  // 実際のドメインは "ap-northeast-1hk1xd4doz.auth.ap-northeast-1.amazoncognito.com" 形式
  await page.waitForURL(/amazoncognito\.com/, { timeout: 30000 });

  // ステップ式: username → Next → (challenge 選択) → password
  await page.locator('input[name="username"]').fill(email);
  await page.locator('button[type="submit"]').click();

  const challengePage = page.locator('button:has-text("Password"), input[name="password"]');
  await challengePage.first().waitFor({ timeout: 15000 });
  if (await page.locator('button:has-text("Password")').isVisible()) {
    await page.locator('button:has-text("Password")').click();
  }

  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // 初回ログイン時の「Change password」チャレンジ（FORCE_CHANGE_PASSWORD 状態）をハンドル
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
}

test.describe("Authentication flow", () => {
  test.beforeEach(({ }, testInfo) => {
    if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
      test.skip(true, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定のためスキップ");
    }
    // Cognito との複数回のネットワーク往復があるため timeout を延長する
    testInfo.setTimeout(120000);
  });

  test("/settings → 未認証で /login → Cognito サインイン → /settings に到達する", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;

    await signInWithCognito(page, email, password);

    // /settings への到達を確認（最大 30 秒）
    await page.waitForURL(/\/settings/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/settings/);

    // 設定ページの見出しが表示されている
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("サインイン後に /settings ページの設定フォームが表示される", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;

    await signInWithCognito(page, email, password);

    // /settings への到達を確認（最大 30 秒）
    await page.waitForURL(/\/settings/, { timeout: 30000 });

    // アプリケーションID 入力欄が表示されている
    await expect(page.getByLabel(/アプリケーションID/i)).toBeVisible();
  });
});
