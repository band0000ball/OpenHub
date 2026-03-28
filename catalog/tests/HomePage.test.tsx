import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "../app/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("../lib/api", () => ({
  searchDatasets: vi.fn(),
  browseByCategory: vi.fn(),
  getCredentialStatus: vi.fn().mockResolvedValue(true),
}));

vi.mock("../components/EStatBanner", () => ({
  default: () => null,
}));

import { browseByCategory } from "../lib/api";
const mockBrowse = vi.mocked(browseByCategory);

const mockDatasets = [
  {
    id: "estat:0001",
    source_id: "estat",
    title: "人口統計データ",
    description: "テスト",
    url: "https://example.com",
    tags: [],
    updated_at: "2024-01-01",
  },
];

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a heading", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the search bar", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders category tabs", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders 全て tab as selected by default", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);
    const allTab = screen.getByRole("tab", { name: "全て" });
    expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  it("marks correct tab as selected when category param is set", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);
    const page = await HomePage({
      searchParams: Promise.resolve({ category: "population" }),
    });
    render(page);
    const populationTab = screen.getByRole("tab", { name: "人口・世帯" });
    expect(populationTab).toHaveAttribute("aria-selected", "true");
  });

  // DatasetBrowser の詳細テストは DatasetBrowser.test.tsx でカバー済み
  // (DatasetBrowser は Suspense 内のため、ページレベルから直接検証しない)
});
