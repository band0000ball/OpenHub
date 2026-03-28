/**
 * LoginPage のテスト
 *
 * テスト対象の振る舞い:
 * - マウント時に signIn("cognito") が呼ばれる
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";

// vi.hoisted で巻き上げ：vi.mock ファクトリ内から参照するため
const { mockSignIn } = vi.hoisted(() => ({ mockSignIn: vi.fn() }));

vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

import LoginPage from "../app/login/page";

describe("LoginPage", () => {
  it("マウント時に signIn('cognito') を呼び出す", async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    expect(mockSignIn).toHaveBeenCalledWith("cognito");
  });

  it("ローディングメッセージを表示する", async () => {
    const { getByText } = await act(async () => render(<LoginPage />));

    expect(getByText(/ログイン/)).toBeInTheDocument();
  });
});
