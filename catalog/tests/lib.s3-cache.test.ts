import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DatasetMetadata } from "../types";

// AWS SDK モック — dynamic import をモック
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = mockSend; },
  GetObjectCommand: class { constructor(public params: unknown) {} },
}));

// 環境変数設定
vi.stubEnv("CACHE_BUCKET_NAME", "test-bucket");

import { getMetadata, getLastUpdated, clearCache } from "../lib/s3-cache";

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

function mockS3Response(body: unknown) {
  mockSend.mockResolvedValue({
    Body: {
      transformToString: () => Promise.resolve(JSON.stringify(body)),
    },
  });
}

describe("s3-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getMetadata", () => {
    it("S3 から metadata.json を取得してパースする", async () => {
      mockS3Response({ count: 1, items: sampleItems });

      const result = await getMetadata();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("人口統計データ");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("2 回目の呼び出しはキャッシュを返す", async () => {
      mockS3Response({ count: 1, items: sampleItems });

      await getMetadata();
      await getMetadata();

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("S3 エラー時は空配列を返す", async () => {
      mockSend.mockRejectedValue(new Error("NoSuchKey"));

      const result = await getMetadata();

      expect(result).toEqual([]);
    });
  });

  describe("getLastUpdated", () => {
    it("last_updated.json のタイムスタンプを返す", async () => {
      mockS3Response({ last_updated: "2024-01-01T00:00:00Z" });

      const result = await getLastUpdated();

      expect(result).toBe("2024-01-01T00:00:00Z");
    });

    it("S3 エラー時は null を返す", async () => {
      mockSend.mockRejectedValue(new Error("NoSuchKey"));

      const result = await getLastUpdated();

      expect(result).toBeNull();
    });
  });
});
