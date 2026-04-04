import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DatasetMetadata } from "../types";

const sampleItems: DatasetMetadata[] = [
  {
    id: "estat:0001",
    source_id: "estat",
    title: "人口統計データ",
    description: "テスト",
    url: "https://example.com",
    tags: ["人口"],
    updated_at: "2024-01-01",
  },
];

import { searchCachedMetadata, getLastUpdated } from "../lib/s3-cache";

describe("s3-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchCachedMetadata", () => {
    it("Bypass /cache/metadata にクエリを渡して結果を返す", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: sampleItems,
          total: 1,
          has_next: false,
          limit: 20,
          offset: 0,
        }),
      });

      const result = await searchCachedMetadata("人口");

      expect(result.items).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/cache/metadata?q=%E4%BA%BA%E5%8F%A3"),
      );
    });

    it("source パラメータを渡せる", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: sampleItems,
          total: 1,
          has_next: false,
          limit: 20,
          offset: 0,
        }),
      });

      await searchCachedMetadata("人口", "estat", 10, 0);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("source=estat"),
      );
    });

    it("API エラー時は空の SearchResponse を返す", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

      const result = await searchCachedMetadata("人口");

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("getLastUpdated", () => {
    it("タイムスタンプを取得する", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ last_updated: "2024-01-01T00:00:00Z" }),
      });

      const result = await getLastUpdated();

      expect(result).toBe("2024-01-01T00:00:00Z");
    });

    it("エラー時は null を返す", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

      const result = await getLastUpdated();

      expect(result).toBeNull();
    });
  });
});
