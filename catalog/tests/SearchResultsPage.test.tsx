import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SearchResults from "../components/SearchResults";
import SearchResultsPage from "../app/search/page";

// Mock next/navigation for Client Components inside the page
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("q=人口"),
}));

// Mock the lib/api module
vi.mock("../lib/api", () => ({
  searchDatasets: vi.fn(),
}));

import { searchDatasets } from "../lib/api";
const mockSearchDatasets = vi.mocked(searchDatasets);

const mockResults = {
  items: [
    {
      id: "estat:0003191203",
      source_id: "estat",
      title: "人口統計データ",
      description: "日本の人口統計",
      url: "https://example.com",
      tags: ["人口", "統計"],
      updated_at: "2024-03-15",
    },
    {
      id: "datagojp:001",
      source_id: "datagojp",
      title: "data.go.jp人口データ",
      description: "data.go.jpの人口データ",
      url: "https://data.go.jp",
      tags: ["人口"],
      updated_at: "2024-02-01",
    },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

describe("SearchResults component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dataset cards for each result", async () => {
    mockSearchDatasets.mockResolvedValueOnce(mockResults);

    const component = await SearchResults({ q: "人口", source: "" });
    render(component);

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("人口統計データ")).toBeInTheDocument();
    expect(screen.getByText("data.go.jp人口データ")).toBeInTheDocument();
  });

  it("displays total count", async () => {
    mockSearchDatasets.mockResolvedValueOnce(mockResults);

    const component = await SearchResults({ q: "人口", source: "" });
    render(component);

    expect(screen.getByText(/2 件のデータセットが見つかりました/)).toBeInTheDocument();
  });

  it("renders empty state when no results", async () => {
    mockSearchDatasets.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const component = await SearchResults({ q: "存在しないキーワード", source: "" });
    render(component);

    expect(
      screen.getByText("該当するデータセットが見つかりませんでした")
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("renders error state when search fails", async () => {
    mockSearchDatasets.mockRejectedValueOnce(new Error("Network error"));

    const component = await SearchResults({ q: "人口", source: "" });
    render(component);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/失敗|エラー/);
  });

  it("passes source filter to searchDatasets", async () => {
    mockSearchDatasets.mockResolvedValueOnce({
      items: [mockResults.items[0]],
      total: 1,
      limit: 20,
      offset: 0,
    });

    await SearchResults({ q: "人口", source: "estat" });

    expect(mockSearchDatasets).toHaveBeenCalledWith(
      "人口",
      "estat",
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("passes undefined source when source is empty string", async () => {
    mockSearchDatasets.mockResolvedValueOnce(mockResults);

    await SearchResults({ q: "人口", source: "" });

    expect(mockSearchDatasets).toHaveBeenCalledWith(
      "人口",
      undefined,
      expect.any(Number),
      expect.any(Number)
    );
  });
});

describe("SearchResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders SearchBar and SourceFilterTabs", async () => {
    mockSearchDatasets.mockResolvedValueOnce(mockResults);

    const page = await SearchResultsPage({
      searchParams: Promise.resolve({ q: "人口", source: "" }),
    });
    render(page);

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders with empty params", async () => {
    mockSearchDatasets.mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });

    const page = await SearchResultsPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });
});
