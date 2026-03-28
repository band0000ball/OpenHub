import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/datasets/[id]/route";
import { NextRequest } from "next/server";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const makeRequest = (id: string) => {
  const url = new URL(`http://localhost:3000/api/datasets/${encodeURIComponent(id)}`);
  return new NextRequest(url);
};

const mockPayloadResponse = {
  metadata: {
    id: "estat:0003191203",
    source_id: "estat",
    title: "人口統計",
    description: "日本の人口統計データ",
    url: "https://example.com",
    tags: ["人口", "統計"],
    updated_at: "2024-01-01",
  },
  format: "csv",
  fetched_at: "2024-01-01T00:00:00Z",
  record_count: 100,
  data_encoding: "utf-8" as const,
  data: "col1,col2\nval1,val2",
};

describe("GET /api/datasets/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BYPASS_BASE_URL = "http://localhost:8000";
  });

  afterEach(() => {
    delete process.env.BYPASS_BASE_URL;
  });

  it("fetches dataset by id and returns payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayloadResponse,
    });

    const req = makeRequest("estat:0003191203");
    const res = await GET(req, { params: Promise.resolve({ id: "estat%3A0003191203" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(mockPayloadResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000/datasets/estat%3A0003191203/fetch"),
      expect.any(Object)
    );
  });

  it("returns 502 when upstream responds with error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const req = makeRequest("nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 502 on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const req = makeRequest("estat:0003191203");
    const res = await GET(req, { params: Promise.resolve({ id: "estat%3A0003191203" }) });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("uses default BYPASS_BASE_URL when env not set", async () => {
    delete process.env.BYPASS_BASE_URL;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayloadResponse,
    });

    const req = makeRequest("estat:0003191203");
    await GET(req, { params: Promise.resolve({ id: "estat%3A0003191203" }) });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000/datasets/"),
      expect.any(Object)
    );
  });

  it("preserves encoded id in upstream URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayloadResponse,
    });

    const encodedId = "datagojp%3Asome%2Fdataset";
    const req = makeRequest("datagojp:some/dataset");
    await GET(req, { params: Promise.resolve({ id: encodedId }) });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodedId);
    expect(calledUrl).toContain("/fetch");
  });
});
