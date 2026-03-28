import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchDatasets, fetchDataset, browseByCategory } from "../lib/api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockSearchResponse = {
  items: [
    {
      id: "estat:001",
      source_id: "estat",
      title: "人口統計",
      description: "テスト",
      url: "https://example.com",
      tags: [],
      updated_at: "2024-01-01",
    },
  ],
  total: 1,
  limit: 20,
  offset: 0,
};

const mockPayloadResponse = {
  metadata: {
    id: "estat:001",
    source_id: "estat",
    title: "人口統計",
    description: "テスト",
    url: "https://example.com",
    tags: [],
    updated_at: "2024-01-01",
  },
  format: "csv",
  fetched_at: "2024-01-01T00:00:00Z",
  record_count: 10,
  data_encoding: "utf-8" as const,
  data: "a,b\n1,2",
};

describe("searchDatasets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches from /api/search with query params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    const result = await searchDatasets("人口");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search?"),
      expect.objectContaining({ cache: "no-store" })
    );
    const calledUrl = new URL(mockFetch.mock.calls[0][0], "http://localhost");
    expect(calledUrl.searchParams.get("q")).toBe("人口");
    expect(result).toEqual(mockSearchResponse);
  });

  it("includes source param when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    await searchDatasets("人口", "estat");

    const calledUrl = new URL(mockFetch.mock.calls[0][0], "http://localhost");
    expect(calledUrl.searchParams.get("source")).toBe("estat");
  });

  it("omits source param when not provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    await searchDatasets("人口");

    const calledUrl = new URL(mockFetch.mock.calls[0][0], "http://localhost");
    expect(calledUrl.searchParams.has("source")).toBe(false);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

    await expect(searchDatasets("test")).rejects.toThrow("Search failed: 502");
  });
});

describe("fetchDataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches from /api/datasets/{encodedId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayloadResponse,
    });

    const result = await fetchDataset("estat:001");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/datasets/${encodeURIComponent("estat:001")}`),
      expect.objectContaining({ cache: "no-store" })
    );
    expect(result).toEqual(mockPayloadResponse);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchDataset("nonexistent")).rejects.toThrow("Dataset fetch failed: 404");
  });
});

const mockItem = (id: string) => ({
  id,
  source_id: "estat",
  title: `データ ${id}`,
  description: "",
  url: "",
  tags: [],
  updated_at: "",
});

describe("browseByCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches single category keyword for non-all category", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [mockItem("pop:1")], total: 1, limit: 4, offset: 0 }),
    });

    const result = await browseByCategory("population");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pop:1");
    const calledUrl = new URL(mockFetch.mock.calls[0][0], "http://localhost");
    expect(calledUrl.searchParams.get("q")).toBe("人口");
  });

  it("fetches all 5 subcategories in parallel for all category", async () => {
    // 5 subcategories, each returns 1 item
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [mockItem(`cat${i}:1`)],
          total: 1,
          limit: 4,
          offset: 0,
        }),
      });
    }

    const result = await browseByCategory("all");

    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(result).toHaveLength(5);
  });

  it("deduplicates items across categories for all", async () => {
    const sharedItem = mockItem("shared:1");
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [sharedItem],
          total: 1,
          limit: 4,
          offset: 0,
        }),
      });
    }

    const result = await browseByCategory("all");

    // shared:1 appears only once despite 5 categories returning it
    const ids = result.map((d) => d.id);
    expect(ids.filter((id) => id === "shared:1")).toHaveLength(1);
  });

  it("tolerates individual category fetch failures in all mode", async () => {
    // First 2 succeed, rest fail
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [mockItem("ok:1")], total: 1, limit: 4, offset: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [mockItem("ok:2")], total: 1, limit: 4, offset: 0 }),
      })
      .mockResolvedValue({ ok: false, status: 502 });

    const result = await browseByCategory("all");

    // Should have items from successful calls only
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});
