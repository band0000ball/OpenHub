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

function mockFetchResponse(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 502,
    json: () => Promise.resolve(data),
  });
}

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
    it("Bypass /cache/metadata からデータを取得する", async () => {
      global.fetch = mockFetchResponse({ count: 1, items: sampleItems });

      const result = await getMetadata();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("人口統計データ");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/cache/metadata"),
      );
    });

    it("2 回目の呼び出しはキャッシュを返す", async () => {
      global.fetch = mockFetchResponse({ count: 1, items: sampleItems });

      await getMetadata();
      await getMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("API エラー時は空配列を返す", async () => {
      global.fetch = mockFetchResponse({ error: "fail" }, false);

      const result = await getMetadata();

      expect(result).toEqual([]);
    });
  });

  describe("getLastUpdated", () => {
    it("Bypass /cache/last_updated からタイムスタンプを取得する", async () => {
      global.fetch = mockFetchResponse({ last_updated: "2024-01-01T00:00:00Z" });

      const result = await getLastUpdated();

      expect(result).toBe("2024-01-01T00:00:00Z");
    });

    it("API エラー時は null を返す", async () => {
      global.fetch = mockFetchResponse({ error: "fail" }, false);

      const result = await getLastUpdated();

      expect(result).toBeNull();
    });
  });
});
