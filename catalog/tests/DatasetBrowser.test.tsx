import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DatasetBrowser from "../components/DatasetBrowser";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

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
    id: "datagojp:0001",
    source_id: "datagojp",
    title: "オープンデータ一覧",
    description: "data.go.jp のデータ",
    url: "https://example.com/2",
    tags: ["オープンデータ"],
    updated_at: "2024-02-01",
  },
];

describe("DatasetBrowser — all カテゴリ（ソース別セクション）", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("ソース別セクションを表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        sections: [
          { source_id: "estat", items: [mockDatasets[0]], total: 100 },
          { source_id: "datagojp", items: [mockDatasets[1]], total: 200 },
        ],
      }),
    });

    render(<DatasetBrowser category="all" page={1} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "e-Stat" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "data.go.jp" })).toBeInTheDocument();
    });
    expect(screen.getByText("人口統計データ")).toBeInTheDocument();
    expect(screen.getByText("オープンデータ一覧")).toBeInTheDocument();
    expect(screen.getByText("100 件")).toBeInTheDocument();
    expect(screen.getByText("200 件")).toBeInTheDocument();
  });

  it("フェッチ失敗時はエラー状態を表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

    render(<DatasetBrowser category="all" page={1} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

describe("DatasetBrowser — 個別カテゴリ", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("カテゴリ検索結果を表示する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: mockDatasets,
        total: 2,
        has_next: false,
        page: 1,
      }),
    });

    render(<DatasetBrowser category="population" page={1} />);

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(2);
    });
  });

  it("has_next=true のとき次へボタンが表示される", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: mockDatasets,
        total: null,
        has_next: true,
        page: 1,
      }),
    });

    render(<DatasetBrowser category="population" page={1} />);

    await waitFor(() => {
      const nextLink = screen.getByRole("link", { name: "次へ" });
      expect(nextLink).toHaveAttribute("href", "/?category=population&page=2");
    });
  });
});
