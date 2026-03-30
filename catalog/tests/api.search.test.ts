import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/search/route";
import { NextRequest } from "next/server";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const makeRequest = (params: Record<string, string> = {}) => {
  const url = new URL("http://localhost:3000/api/search");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
};

const mockSearchResponse = {
  items: [
    {
      id: "estat:0003191203",
      source_id: "estat",
      title: "人口統計",
      description: "日本の人口統計データ",
      url: "https://example.com",
      tags: ["人口", "統計"],
      updated_at: "2024-01-01",
    },
  ],
  total: 1,
  limit: 10,
  offset: 0,
};

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_BYPASS_BASE_URL = "http://localhost:8000";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BYPASS_BASE_URL;
  });

  it("forwards query parameters to bypass and returns search results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    const req = makeRequest({ q: "人口", source: "estat", limit: "10", offset: "0" });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(mockSearchResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000/datasets/search"),
      expect.any(Object)
    );
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get("q")).toBe("人口");
    expect(calledUrl.searchParams.get("source")).toBe("estat");
  });

  it("uses default BYPASS_BASE_URL when env var not set", async () => {
    delete process.env.NEXT_PUBLIC_BYPASS_BASE_URL;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    const req = makeRequest({ q: "test" });
    await GET(req);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000/datasets/search"),
      expect.any(Object)
    );
  });

  it("omits empty parameters from upstream request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    const req = makeRequest({ q: "人口" });
    await GET(req);

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get("q")).toBe("人口");
    expect(calledUrl.searchParams.has("source")).toBe(false);
  });

  it("returns 502 when bypass responds with error status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ detail: "service unavailable" }),
    });

    const req = makeRequest({ q: "人口" });
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 502 when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const req = makeRequest({ q: "人口" });
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("handles empty query string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0, limit: 10, offset: 0 }),
    });

    const req = makeRequest({});
    const res = await GET(req);

    expect(res.status).toBe(200);
  });
});
