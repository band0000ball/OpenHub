import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DatasetBrowser from "../components/DatasetBrowser";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("../lib/api", () => ({
  searchDatasets: vi.fn(),
  browseByCategory: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import { browseByCategory, searchDatasets } from "../lib/api";
const mockBrowse = vi.mocked(browseByCategory);
const mockSearch = vi.mocked(searchDatasets);

const mockDatasets = [
  {
    id: "estat:0001",
    source_id: "estat",
    title: "人口統計データ",
    description: "日本の人口統計",
    url: "https://example.com",
    tags: ["人口"],
    updated_at: "2024-01-01",
  },
  {
    id: "datagojp:0002",
    source_id: "datagojp",
    title: "経済指標データ",
    description: "経済に関するデータ",
    url: "https://example.com",
    tags: ["経済"],
    updated_at: "2024-02-01",
  },
];

const mockSearchResult = {
  items: mockDatasets,
  total: 2,
  has_next: false,
  limit: 20,
  offset: 0,
};

describe("DatasetBrowser — all カテゴリ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("browseByCategory を呼んでカードを表示する", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);

    const component = await DatasetBrowser({ category: "all", page: 1 });
    render(component);

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("人口統計データ")).toBeInTheDocument();
    expect(mockBrowse).toHaveBeenCalledWith("all");
  });

  it("件数ゼロの場合は空状態を表示する", async () => {
    mockBrowse.mockResolvedValueOnce([]);

    const component = await DatasetBrowser({ category: "all", page: 1 });
    render(component);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
  });

  it("フェッチ失敗時はエラー状態を表示する", async () => {
    mockBrowse.mockRejectedValueOnce(new Error("Network error"));

    const component = await DatasetBrowser({ category: "all", page: 1 });
    render(component);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("DatasetBrowser — 個別カテゴリ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searchDatasets を呼んでカードとページネーションを表示する", async () => {
    mockSearch.mockResolvedValueOnce(mockSearchResult);

    const component = await DatasetBrowser({ category: "population", page: 1 });
    render(component);

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(mockSearch).toHaveBeenCalledWith("人口", undefined, 20, 0);
    expect(mockBrowse).not.toHaveBeenCalled();
  });

  it("page=2 のとき offset=20 で searchDatasets を呼ぶ", async () => {
    mockSearch.mockResolvedValueOnce({ ...mockSearchResult, offset: 20 });

    await DatasetBrowser({ category: "population", page: 2 });

    expect(mockSearch).toHaveBeenCalledWith("人口", undefined, 20, 20);
  });

  it("has_next=true のとき次へボタンがリンクとして表示される", async () => {
    mockSearch.mockResolvedValueOnce({ ...mockSearchResult, has_next: true, total: null });

    const component = await DatasetBrowser({ category: "population", page: 1 });
    render(component);

    const nextLink = screen.getByRole("link", { name: "次へ" });
    expect(nextLink).toHaveAttribute("href", "/?category=population&page=2");
  });

  it("件数ゼロの場合は空状態を表示する", async () => {
    mockSearch.mockResolvedValueOnce({ ...mockSearchResult, items: [] });

    const component = await DatasetBrowser({ category: "population", page: 1 });
    render(component);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
  });
});
