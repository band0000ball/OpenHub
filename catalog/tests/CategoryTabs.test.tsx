import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryTabs from "../components/CategoryTabs";

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

describe("CategoryTabs", () => {
  it("renders 6 tabs", () => {
    render(<CategoryTabs currentCategory="all" />);
    expect(screen.getAllByRole("tab")).toHaveLength(6);
  });

  it("renders 全て tab", () => {
    render(<CategoryTabs currentCategory="all" />);
    expect(screen.getByRole("tab", { name: "全て" })).toBeInTheDocument();
  });

  it("marks currentCategory tab as selected", () => {
    render(<CategoryTabs currentCategory="population" />);
    const populationTab = screen.getByRole("tab", { name: "人口・世帯" });
    expect(populationTab).toHaveAttribute("aria-selected", "true");
  });

  it("marks other tabs as not selected", () => {
    render(<CategoryTabs currentCategory="all" />);
    const allTab = screen.getByRole("tab", { name: "全て" });
    expect(allTab).toHaveAttribute("aria-selected", "true");
    const populationTab = screen.getByRole("tab", { name: "人口・世帯" });
    expect(populationTab).toHaveAttribute("aria-selected", "false");
  });

  it("全て tab links to /", () => {
    render(<CategoryTabs currentCategory="population" />);
    const allTab = screen.getByRole("tab", { name: "全て" });
    expect(allTab).toHaveAttribute("href", "/");
  });

  it("人口・世帯 tab links to /?category=population", () => {
    render(<CategoryTabs currentCategory="all" />);
    const populationTab = screen.getByRole("tab", { name: "人口・世帯" });
    expect(populationTab).toHaveAttribute("href", "/?category=population");
  });

  it("has a tablist container", () => {
    render(<CategoryTabs currentCategory="all" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
