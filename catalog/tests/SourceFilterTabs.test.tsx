import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SourceFilterTabs from "../components/SourceFilterTabs";

vi.mock("next/link", () => ({
  default: ({ href, children, className, role, "aria-selected": ariaSelected }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    role?: string;
    "aria-selected"?: boolean;
  }) => (
    <a href={href} className={className} role={role} aria-selected={ariaSelected}>
      {children}
    </a>
  ),
}));

describe("SourceFilterTabs", () => {
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

  it("e-Stat tab href contains source=estat and current query", () => {
    render(<SourceFilterTabs currentSource="" currentQuery="人口" />);
    const eStatTab = screen.getByRole("tab", { name: "e-Stat" });
    const href = eStatTab.getAttribute("href") ?? "";
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("source")).toBe("estat");
    expect(params.get("q")).toBe("人口");
  });

  it("全て tab href has no source param but includes query", () => {
    render(<SourceFilterTabs currentSource="estat" currentQuery="人口" />);
    const allTab = screen.getByRole("tab", { name: "全て" });
    const href = allTab.getAttribute("href") ?? "";
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("q")).toBe("人口");
    expect(params.has("source")).toBe(false);
  });

  it("data.go.jp tab href contains source=datagojp", () => {
    render(<SourceFilterTabs currentSource="" currentQuery="人口" />);
    const dataTab = screen.getByRole("tab", { name: "data.go.jp" });
    const href = dataTab.getAttribute("href") ?? "";
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("source")).toBe("datagojp");
  });
});
