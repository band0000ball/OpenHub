import { test, expect } from "@playwright/test";

/**
 * 設定ページの E2E テスト
 *
 * 未認証テスト: chromium プロジェクトで実行（認証不要）
 * 認証済みテスト: chromium-authenticated プロジェクトで実行（storageState 必要）
 */

test.describe("Settings page - 未認証", () => {
  test("/settings にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/settings");
    // proxy.ts による認証ガード: /settings → /login へリダイレクト
    // /login は即座に Cognito にリダイレクトするため、/login または Cognito ドメインへの到達を確認
    await page.waitForURL(/\/(login)|cognito.*\.amazoncognito\.com/, { timeout: 10000 });
    expect(
      page.url().includes("/login") || page.url().includes("amazoncognito.com")
    ).toBe(true);
  });
});

test.describe("Settings page - 認証済み", () => {
  test.beforeEach(() => {
    if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
      test.skip(true, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定のためスキップ");
    }
  });

  test("設定ページに取得手順セクションが表示される", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);

    // EStatGuideSteps コンポーネント: <details id="estat-guide">
    const guideSection = page.locator("#estat-guide");
    await expect(guideSection).toBeVisible();
  });

  test("取得手順セクションを展開すると手順リストが表示される", async ({ page }) => {
    await page.goto("/settings");

    const summary = page.locator("#estat-guide summary");
    await summary.click();

    // 展開後に <ol> が表示される
    const stepList = page.locator("#estat-guide ol");
    await expect(stepList).toBeVisible();

    // 4 ステップが存在する
    const steps = stepList.locator("li");
    await expect(steps).toHaveCount(4);
  });

  test("e-Stat ユーザー登録ページへの外部リンクが存在する", async ({ page }) => {
    await page.goto("/settings");

    const summary = page.locator("#estat-guide summary");
    await summary.click();

    const link = page.locator("#estat-guide a[target='_blank']");
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^https:\/\//);
  });
});
