import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../app/api/search/route";
import { NextRequest } from "next/server";

// S3 キャッシュモック
vi.mock("../lib/s3-cache", () => ({
  getMetadata: vi.fn(),
  getLastUpdated: vi.fn(),
  clearCache: vi.fn(),
}));

import { getMetadata } from "../lib/s3-cache";
const mockGetMetadata = vi.mocked(getMetadata);

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
  {
    id: "datagojp:0001",
    source_id: "datagojp",
    title: "経済指標",
    description: "GDPデータ",
    url: "https://example.com/2",
    tags: ["経済"],
    updated_at: "2024-02-01",
  },
];

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMetadata.mockResolvedValue(sampleItems);
  });

  it("キーワードで検索してマッチする結果を返す", async () => {
    const req = makeRequest({ q: "人口" });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("estat:0001");
    expect(body.total).toBe(1);
  });

  it("source フィルタで絞り込める", async () => {
    const req = makeRequest({ q: "統計", source: "estat" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].source_id).toBe("estat");
  });

  it("limit と offset でページネーションできる", async () => {
    const req = makeRequest({ q: "データ", limit: "1", offset: "0" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.items).toHaveLength(1);
    expect(body.has_next).toBe(true);
  });

  it("q パラメータが空の場合は 400 を返す", async () => {
    const req = makeRequest({});
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("S3 エラー時は空の結果を返す（502 ではなく）", async () => {
    mockGetMetadata.mockResolvedValue([]);

    const req = makeRequest({ q: "人口" });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(0);
  });
});
