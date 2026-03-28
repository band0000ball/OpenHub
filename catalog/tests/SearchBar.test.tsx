import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "../components/SearchBar";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams("q=初期値"),
}));

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input with correct aria-label", () => {
    render(<SearchBar />);
    const input = screen.getByRole("searchbox", { name: "データセットを検索" });
    expect(input).toBeInTheDocument();
  });

  it("initializes with query from URL search params", () => {
    render(<SearchBar />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.value).toBe("初期値");
  });

  it("renders submit button", () => {
    render(<SearchBar />);
    const button = screen.getByRole("button", { name: /検索/i });
    expect(button).toBeInTheDocument();
  });

  it("navigates to /search with query on form submit", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByRole("searchbox");
    await user.clear(input);
    await user.type(input, "人口");

    const button = screen.getByRole("button", { name: /検索/i });
    await user.click(button);

    expect(mockPush).toHaveBeenCalledWith("/search?q=%E4%BA%BA%E5%8F%A3");
  });

  it("does not navigate when query is empty", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByRole("searchbox");
    await user.clear(input);

    const button = screen.getByRole("button", { name: /検索/i });
    await user.click(button);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not navigate when query is only whitespace", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByRole("searchbox");
    await user.clear(input);
    await user.type(input, "   ");

    const button = screen.getByRole("button", { name: /検索/i });
    await user.click(button);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates on Enter key press", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByRole("searchbox");
    await user.clear(input);
    await user.type(input, "統計{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/search?q=%E7%B5%B1%E8%A8%88");
  });

  it("updates input value when user types", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "新しい検索");

    expect(input.value).toBe("新しい検索");
  });

  it("accepts initialQuery prop", () => {
    render(<SearchBar initialQuery="プロップ初期値" />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.value).toBe("プロップ初期値");
  });
});
