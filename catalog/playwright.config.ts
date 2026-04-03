import { defineConfig, devices } from "@playwright/test";

const authStatePath = ".auth/state.json";
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const isRemote = baseURL !== "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI/リモート: 2 retries。ローカル: 1 retry（dev server cold-start 対策）
  retries: (process.env.CI || isRemote) ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
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
      testIgnore: /auth\.(setup|spec)\.ts|settings\.spec\.ts/,
    },
    // 認証フローテスト（storageState なし — ログインフローを直接テストする）
    {
      name: "auth-flow",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /auth\.spec\.ts/,
    },
    // 認証済み状態が必要なテスト（storageState でセッションを再利用する）
    {
      name: "chromium-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
      testMatch: /settings\.spec\.ts/,
    },
  ],
  // リモート（AWS）テスト時はローカルサーバーを起動しない
  ...(!isRemote && {
    webServer: {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      // Bypass を意図的に存在しないポートに向けてエラー表示テストを安定させる
      // Cognito 認証情報は .env.local から自動ロードされるため、ここでは設定しない
      env: {
        NEXT_PUBLIC_BYPASS_BASE_URL: process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? "http://localhost:19999",
      },
    },
  }),
});
