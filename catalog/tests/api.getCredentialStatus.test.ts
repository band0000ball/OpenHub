import { describe, it, expect, vi, afterEach } from "vitest";
import { getCredentialStatus } from "../lib/api";

describe("getCredentialStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when Bypass responds configured: true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ source_id: "estat", configured: true }),
      })
    );

    const result = await getCredentialStatus("estat");

    expect(result).toBe(true);
  });

  it("returns false when Bypass responds configured: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ source_id: "estat", configured: false }),
      })
    );

    const result = await getCredentialStatus("estat");

    expect(result).toBe(false);
  });

  it("returns false when Bypass responds with non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
    );

    const result = await getCredentialStatus("estat");

    expect(result).toBe(false);
  });

  it("returns false when fetch throws (Bypass unreachable)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Connection refused"))
    );

    const result = await getCredentialStatus("estat");

    expect(result).toBe(false);
  });

  it("calls correct Bypass endpoint with encoded sourceId", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source_id: "estat", configured: false }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getCredentialStatus("estat");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/auth/credentials/estat/status");
  });
});
