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

import { getMetadata, getLastUpdated, clearCache } from "../lib/s3-cache";

describe("s3-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getMetadata", () => {
    it("4ソースを並列取得して統合する", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("source=estat")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: sampleItems }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      });

      const result = await getMetadata();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("人口統計データ");
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it("2 回目の呼び出しはキャッシュを返す", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: sampleItems }),
      });

      await getMetadata();
      const callCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      await getMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(callCount);
    });

    it("全ソース失敗時は空配列を返す", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

      const result = await getMetadata();

      expect(result).toEqual([]);
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
