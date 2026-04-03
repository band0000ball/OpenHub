/**
 * LoginPage のテスト
 *
 * テスト対象の振る舞い:
 * - サーバーサイドで signIn("cognito", { redirectTo }) が呼ばれる
 */

import { describe, expect, it, vi } from "vitest";

const { mockSignIn } = vi.hoisted(() => ({ mockSignIn: vi.fn() }));

vi.mock("../auth", () => ({
  signIn: mockSignIn,
}));

import LoginPage from "../app/login/page";

describe("LoginPage", () => {
  it("サーバーサイドで signIn('cognito') を呼び出す", async () => {
    await LoginPage({ searchParams: Promise.resolve({}) }).catch(() => {});

    expect(mockSignIn).toHaveBeenCalledWith("cognito", { redirectTo: "/" });
  });

  it("callbackUrl が指定されている場合はそれを redirectTo に渡す", async () => {
    await LoginPage({
      searchParams: Promise.resolve({ callbackUrl: "/settings" }),
    }).catch(() => {});

    expect(mockSignIn).toHaveBeenCalledWith("cognito", { redirectTo: "/settings" });
  });
});
