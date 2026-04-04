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
    id: "datagojp:0002",
    source_id: "datagojp",
    title: "経済指標データ",
    description: "経済に関するデータ",
    url: "https://example.com",
    tags: ["経済"],
    updated_at: "2024-02-01",
  },
];

function mockFetchResponse(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 502,
    json: () => Promise.resolve(data),
  });
}

describe("DatasetBrowser — all カテゴリ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("スケルトン → データ表示の順で描画する", async () => {
    global.fetch = mockFetchResponse({
      items: mockDatasets,
      total: null,
      has_next: false,
      page: 1,
    });

    render(<DatasetBrowser category="all" page={1} />);

    // 初期状態: スケルトン表示
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    // データ取得後: カード表示
    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(2);
    });
    expect(screen.getByText("人口統計データ")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/browse?category=all&page=1");
  });

  it("件数ゼロの場合は空状態を表示する", async () => {
    global.fetch = mockFetchResponse({
      items: [],
      total: 0,
      has_next: false,
      page: 1,
    });

    render(<DatasetBrowser category="all" page={1} />);

    await waitFor(() => {
      expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
    });
  });

  it("フェッチ失敗時はエラー状態を表示する", async () => {
    global.fetch = mockFetchResponse({ error: "fail" }, false);

    render(<DatasetBrowser category="all" page={1} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

describe("DatasetBrowser — 個別カテゴリ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("category=population で正しいクエリを送る", async () => {
    global.fetch = mockFetchResponse({
      items: mockDatasets,
      total: 2,
      has_next: false,
      page: 1,
    });

    render(<DatasetBrowser category="population" page={1} />);

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(2);
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/browse?category=population&page=1");
  });

  it("page=2 で正しいクエリを送る", async () => {
    global.fetch = mockFetchResponse({
      items: mockDatasets,
      total: 40,
      has_next: true,
      page: 2,
    });

    render(<DatasetBrowser category="population" page={2} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/browse?category=population&page=2");
    });
  });

  it("has_next=true のとき次へボタンが表示される", async () => {
    global.fetch = mockFetchResponse({
      items: mockDatasets,
      total: null,
      has_next: true,
      page: 1,
    });

    render(<DatasetBrowser category="population" page={1} />);

    await waitFor(() => {
      const nextLink = screen.getByRole("link", { name: "次へ" });
      expect(nextLink).toHaveAttribute("href", "/?category=population&page=2");
    });
  });
});
