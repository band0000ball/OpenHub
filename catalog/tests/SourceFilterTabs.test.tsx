import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SourceFilterTabs from "../components/SourceFilterTabs";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams("q=人口&source="),
}));

describe("SourceFilterTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tablist with correct role", () => {
    render(<SourceFilterTabs currentSource="" currentQuery="人口" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders all three tabs: 全て, e-Stat, data.go.jp", () => {
    render(<SourceFilterTabs currentSource="" currentQuery="人口" />);
    expect(screen.getByRole("tab", { name: "全て" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "e-Stat" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "data.go.jp" })).toBeInTheDocument();
  });

  it("marks active tab with aria-selected=true", () => {
    render(<SourceFilterTabs currentSource="" currentQuery="人口" />);
    const allTab = screen.getByRole("tab", { name: "全て" });
    expect(allTab).toHaveAttribute("aria-selected", "true");

    const eStatTab = screen.getByRole("tab", { name: "e-Stat" });
    expect(eStatTab).toHaveAttribute("aria-selected", "false");
  });

  it("marks estat tab as selected when source=estat", () => {
    render(<SourceFilterTabs currentSource="estat" currentQuery="人口" />);
    const eStatTab = screen.getByRole("tab", { name: "e-Stat" });
    expect(eStatTab).toHaveAttribute("aria-selected", "true");

    const allTab = screen.getByRole("tab", { name: "全て" });
    expect(allTab).toHaveAttribute("aria-selected", "false");
  });

  it("marks datagojp tab as selected when source=datagojp", () => {
    render(<SourceFilterTabs currentSource="datagojp" currentQuery="人口" />);
    const dataTab = screen.getByRole("tab", { name: "data.go.jp" });
    expect(dataTab).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to /search with source param on tab click", async () => {
    const user = userEvent.setup();
    render(<SourceFilterTabs currentSource="" currentQuery="人口" />);

    const eStatTab = screen.getByRole("tab", { name: "e-Stat" });
    await user.click(eStatTab);

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("/search?")
    );
    const calledUrl = mockPush.mock.calls[0][0];
    const params = new URLSearchParams(calledUrl.split("?")[1]);
    expect(params.get("source")).toBe("estat");
    expect(params.get("q")).toBe("人口");
  });

  it("navigates without source param when 全て tab clicked", async () => {
    const user = userEvent.setup();
    render(<SourceFilterTabs currentSource="estat" currentQuery="人口" />);

    const allTab = screen.getByRole("tab", { name: "全て" });
    await user.click(allTab);

    const calledUrl = mockPush.mock.calls[0][0];
    const params = new URLSearchParams(calledUrl.split("?")[1]);
    expect(params.get("q")).toBe("人口");
    expect(params.has("source")).toBe(false);
  });

  it("navigates with datagojp source", async () => {
    const user = userEvent.setup();
    render(<SourceFilterTabs currentSource="" currentQuery="人口" />);

    const dataTab = screen.getByRole("tab", { name: "data.go.jp" });
    await user.click(dataTab);

    const calledUrl = mockPush.mock.calls[0][0];
    const params = new URLSearchParams(calledUrl.split("?")[1]);
    expect(params.get("source")).toBe("datagojp");
  });
});
