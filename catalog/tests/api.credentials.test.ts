import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/credentials/route";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards request to Bypass and returns 200 on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source_id: "estat",
        message: "'estat' の APIキーを設定しました。",
      }),
    });

    const response = await POST(makeRequest({ source_id: "estat", api_key: "test-key" }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.source_id).toBe("estat");
  });

  it("calls Bypass at /auth/credentials", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ source_id: "estat", message: "ok" }),
    });

    await POST(makeRequest({ source_id: "estat", api_key: "test-key" }));

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/auth/credentials");
  });

  it("forwards source_id and api_key to Bypass", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ source_id: "estat", message: "ok" }),
    });

    await POST(makeRequest({ source_id: "estat", api_key: "my-key-123" }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.source_id).toBe("estat");
    expect(body.api_key).toBe("my-key-123");
  });

  it("returns 400 when request body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("returns 502 when Bypass is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const response = await POST(makeRequest({ source_id: "estat", api_key: "key" }));
    expect(response.status).toBe(502);
  });

  it("returns Bypass error status when upstream returns non-ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: "unknown source" }),
    });

    const response = await POST(makeRequest({ source_id: "unknown", api_key: "key" }));
    expect(response.status).toBe(502);
  });
});
