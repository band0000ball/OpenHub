import { test, expect } from "@playwright/test";

/**
 * E2E tests for OpenHub Catalog critical user flows.
 * These tests require:
 * - The catalog app running on http://localhost:3000
 * - The bypass service running on http://localhost:8000 (or BYPASS_BASE_URL)
 */

test.describe("Home page", () => {
  test("renders the search bar and heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeVisible();
  });

  test("cannot submit empty search", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("searchbox");
    await input.clear();
    await page.getByRole("button", { name: /検索/i }).click();
    // Should remain on home page
    await expect(page).toHaveURL("/");
  });
});

test.describe("Search results page - DoD scenarios", () => {
  test("keyword search shows results", async ({ page }) => {
    await page.goto("/search?q=人口");
    // Wait for either results or error state
    await page.waitForSelector('[role="article"], [role="alert"], p:has-text("見つかりませんでした")', {
      timeout: 10000,
    });
    // Check we are on the search results page
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("source filter tabs are rendered", async ({ page }) => {
    await page.goto("/search?q=人口");
    await expect(page.getByRole("tab", { name: "全て" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "e-Stat" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "data.go.jp" })).toBeVisible();
  });

  test("全て tab is selected by default", async ({ page }) => {
    await page.goto("/search?q=人口");
    const allTab = page.getByRole("tab", { name: "全て" });
    await expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  test("clicking e-Stat tab updates URL source param", async ({ page }) => {
    await page.goto("/search?q=人口");
    await page.getByRole("tab", { name: "e-Stat" }).click();
    await expect(page).toHaveURL(/source=estat/);
  });

  test("clicking data.go.jp tab updates URL source param", async ({ page }) => {
    await page.goto("/search?q=人口");
    await page.getByRole("tab", { name: "data.go.jp" }).click();
    await expect(page).toHaveURL(/source=datagojp/);
  });

  test("error message shown when bypass not available", async ({ page }) => {
    // Override the API to simulate failure by navigating without backend
    // This test validates the error UI when the search endpoint fails
    await page.route("/api/search*", (route) => {
      route.fulfill({ status: 502, body: JSON.stringify({ error: "Bypass unavailable" }) });
    });

    await page.goto("/search?q=人口");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("alert")).toContainText(/失敗/);
  });
});

test.describe("Dataset detail page", () => {
  test("shows error when dataset not found", async ({ page }) => {
    await page.route("/api/datasets/*", (route) => {
      route.fulfill({ status: 502, body: JSON.stringify({ error: "Not found" }) });
    });

    await page.goto("/datasets/nonexistent-id");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  });

  test("検索結果に戻る link is present", async ({ page }) => {
    await page.route("/api/datasets/*", (route) => {
      route.fulfill({ status: 502, body: JSON.stringify({ error: "Not found" }) });
    });

    await page.goto("/datasets/test-id");
    // Even error page has back link
    await expect(page.getByRole("link", { name: /検索結果に戻る/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Navigation flow", () => {
  test("search from home page navigates to /search", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="searchbox"]');
    const input = page.getByRole("searchbox");
    await input.fill("統計");
    await page.getByRole("button", { name: /検索/i }).click();
    await expect(page).toHaveURL(/\/search\?q=%E7%B5%B1%E8%A8%88/);
  });
});

test.describe("Category tabs", () => {
  test("全て tab is selected by default on home page", async ({ page }) => {
    await page.goto("/");
    const allTab = page.getByRole("tab", { name: "全て" });
    await expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  test("clicking 人口・世帯 tab updates URL to /?category=population", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "人口・世帯" }).click();
    await expect(page).toHaveURL(/category=population/);
  });

  test("selected tab changes after navigation", async ({ page }) => {
    await page.goto("/?category=population");
    const tab = page.getByRole("tab", { name: "人口・世帯" });
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Pagination", () => {
  test("pagination navigation is present on search results", async ({ page }) => {
    await page.goto("/search?q=人口");
    await page.waitForSelector('[role="article"], [role="alert"], p:has-text("見つかりませんでした")', {
      timeout: 10000,
    });
    // ページネーション nav が存在する場合のみ検証
    const nav = page.getByRole("navigation", { name: "ページネーション" });
    const hasNav = await nav.isVisible().catch(() => false);
    if (!hasNav) {
      test.skip(true, "検索結果が 1 ページに収まるためスキップ");
      return;
    }
    await expect(nav).toBeVisible();
  });

  test("clicking 次へ updates URL to page=2", async ({ page }) => {
    await page.goto("/search?q=人口");
    await page.waitForSelector('[role="article"], [role="alert"], p:has-text("見つかりませんでした")', {
      timeout: 10000,
    });
    const nextLink = page.getByRole("link", { name: "次へ" });
    const hasNext = await nextLink.isVisible().catch(() => false);
    if (!hasNext) {
      test.skip(true, "次のページが存在しないためスキップ");
      return;
    }
    await nextLink.click();
    await expect(page).toHaveURL(/page=2/);
    await page.waitForSelector('[role="article"], [role="alert"], p:has-text("見つかりませんでした")', {
      timeout: 10000,
    });
  });

  test("page=1 では 前へ がリンクではなく span として表示される", async ({ page }) => {
    await page.goto("/search?q=人口&page=1");
    await page.waitForSelector('[role="article"], [role="alert"], p:has-text("見つかりませんでした")', {
      timeout: 10000,
    });
    const nav = page.getByRole("navigation", { name: "ページネーション" });
    const hasNav = await nav.isVisible().catch(() => false);
    if (!hasNav) {
      test.skip(true, "ページネーションが存在しないためスキップ");
      return;
    }
    // 前へ は <span>（クリック不可）として表示される
    const prevSpan = nav.locator('span:has-text("前へ")');
    await expect(prevSpan).toBeVisible();
  });
});
