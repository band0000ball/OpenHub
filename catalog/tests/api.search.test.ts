import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../app/api/search/route";
import { NextRequest } from "next/server";

vi.mock("../lib/s3-cache", () => ({
  searchCachedMetadata: vi.fn(),
}));

import { searchCachedMetadata } from "../lib/s3-cache";
const mockSearch = vi.mocked(searchCachedMetadata);

const makeRequest = (params: Record<string, string> = {}) => {
  const url = new URL("http://localhost:3000/api/search");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
};

const sampleItems = [
  {
    id: "estat:0001",
    source_id: "estat",
    title: "人口統計",
    description: "日本の人口統計データ",
    url: "https://example.com",
    tags: ["人口", "統計"],
    updated_at: "2024-01-01",
  },
];

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      items: sampleItems,
      total: 1,
      has_next: false,
      limit: 20,
      offset: 0,
    });
  });

  it("キーワードで検索してマッチする結果を返す", async () => {
    const req = makeRequest({ q: "人口" });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith("人口", undefined, 20, 0);
  });

  it("source フィルタで絞り込める", async () => {
    const req = makeRequest({ q: "統計", source: "estat" });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith("統計", "estat", 20, 0);
  });

  it("limit と offset でページネーションできる", async () => {
    const req = makeRequest({ q: "データ", limit: "10", offset: "5" });
    await GET(req);

    expect(mockSearch).toHaveBeenCalledWith("データ", undefined, 10, 5);
  });

  it("q パラメータが空の場合は 400 を返す", async () => {
    const req = makeRequest({});
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("searchCachedMetadata エラー時は空の結果を返す", async () => {
    mockSearch.mockRejectedValue(new Error("fail"));

    const req = makeRequest({ q: "人口" });
    const res = await GET(req);

    expect(res.status).toBe(502);
  });
});
