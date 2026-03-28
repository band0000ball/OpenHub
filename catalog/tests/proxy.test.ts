/**
 * proxy.ts（認証ガード）のテスト
 *
 * テスト対象の振る舞い:
 * - 未認証で /settings にアクセス → /login へリダイレクト
 * - 認証済みで /settings にアクセス → パススルー（undefined 返却）
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// auth() を mock する: auth(handler) → handler をそのまま返す（テストで直接呼べるように）
vi.mock("../auth", () => ({
  auth: (handler: (req: { auth: unknown; nextUrl: URL }) => unknown) => handler,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// proxy.ts を mock セットアップ後にインポート（vi.mock は巻き上げ済み）
import proxy from "../proxy";

type MockRequest = {
  auth: unknown;
  nextUrl: URL;
};

const makeRequest = (pathname: string, authValue: unknown = null): MockRequest => ({
  auth: authValue,
  nextUrl: new URL(`http://localhost:3000${pathname}`),
});

describe("proxy — 認証ガード", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証のとき /login へリダイレクトする", () => {
    const req = makeRequest("/settings");

    const result = (proxy as (req: MockRequest) => unknown)(req);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as Response;
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toContain("/login");
  });

  it("認証済みのとき undefined を返す（パススルー）", () => {
    const req = makeRequest("/settings", { user: { name: "test-user" } });

    const result = (proxy as (req: MockRequest) => unknown)(req);

    expect(result).toBeUndefined();
  });
});
