import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "../app/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // DatasetBrowser と CredentialsBanner のクライアント fetch をモック
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0, has_next: false, page: 1, unconfigured: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a heading", async () => {
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the search bar", async () => {
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders category tabs", async () => {
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders 全て tab as selected by default", async () => {
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    const allTab = screen.getByRole("tab", { name: "全て" });
    expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  it("marks correct tab as selected when category param is set", async () => {
    const page = await HomePage({
      searchParams: Promise.resolve({ category: "population" }),
    });
    render(page);
    const populationTab = screen.getByRole("tab", { name: "人口・世帯" });
    expect(populationTab).toHaveAttribute("aria-selected", "true");
  });
});
