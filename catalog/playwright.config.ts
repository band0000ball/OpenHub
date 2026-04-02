import { defineConfig, devices } from "@playwright/test";

const authStatePath = ".auth/state.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI: 2 retries (cold start + flakiness). Local: 1 retry for cold-start (dev server route compilation)
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // 認証セットアップ（storageState を生成する）
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // 認証不要なテスト（既存）
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /auth\.setup\.ts/,
    },
    // 認証済み状態が必要なテスト
    {
      name: "chromium-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
      testMatch: /\.(auth|settings)\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // E2E テスト用ダミー環境変数（auth.ts の requireEnv を通過させるため）
    // 実際の Cognito 認証は E2E_TEST_EMAIL/PASSWORD を設定した場合のみ使用する
    env: {
      AUTH_COGNITO_ID: process.env.AUTH_COGNITO_ID ?? "e2e-test-placeholder",
      AUTH_COGNITO_SECRET: process.env.AUTH_COGNITO_SECRET ?? "e2e-test-placeholder",
      AUTH_COGNITO_ISSUER: process.env.AUTH_COGNITO_ISSUER ?? "https://cognito-idp.ap-northeast-1.amazonaws.com/e2e-placeholder",
      AUTH_COGNITO_DOMAIN: process.env.AUTH_COGNITO_DOMAIN ?? "https://e2e-placeholder.auth.ap-northeast-1.amazoncognito.com",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-test-secret-32-chars-placeholder",
      // Bypass を意図的に存在しないポートに向けてエラー表示テストを安定させる
      // 実際の Bypass サーバーに向けたい場合は環境変数で上書きする
      NEXT_PUBLIC_BYPASS_BASE_URL: process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? "http://localhost:19999",
    },
  },
});
