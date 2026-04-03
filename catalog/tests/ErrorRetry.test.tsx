import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorRetry from "../components/ErrorRetry";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe("ErrorRetry", () => {
  it("デフォルトメッセージを表示する", () => {
    render(<ErrorRetry />);
    expect(screen.getByRole("alert")).toHaveTextContent("データの取得に失敗しました");
  });

  it("カスタムメッセージを表示する", () => {
    render(<ErrorRetry message="検索に失敗しました" />);
    expect(screen.getByRole("alert")).toHaveTextContent("検索に失敗しました");
  });

  it("再試行ボタンを表示する", () => {
    render(<ErrorRetry />);
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("再試行ボタンクリックで router.refresh() を呼ぶ", () => {
    render(<ErrorRetry />);
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });
});
