import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryTabs from "../components/CategoryTabs";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(""),
}));

describe("CategoryTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("navigates to / when 全て tab is clicked", () => {
    render(<CategoryTabs currentCategory="population" />);
    fireEvent.click(screen.getByRole("tab", { name: "全て" }));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("navigates to /?category=population when 人口・世帯 tab is clicked", () => {
    render(<CategoryTabs currentCategory="all" />);
    fireEvent.click(screen.getByRole("tab", { name: "人口・世帯" }));
    expect(mockPush).toHaveBeenCalledWith("/?category=population");
  });

  it("has a tablist container", () => {
    render(<CategoryTabs currentCategory="all" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
