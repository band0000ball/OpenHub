import { type NextRequest } from "next/server";

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

export async function GET(request: NextRequest): Promise<Response> {
  const baseUrl = process.env.BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
  const upstreamUrl = new URL(`${baseUrl}/datasets/search`);

  const incomingParams = request.nextUrl.searchParams;
  const allowedParams = ["q", "source", "limit", "offset"];

  for (const key of allowedParams) {
    const value = incomingParams.get(key);
    if (value !== null && value !== "") {
      upstreamUrl.searchParams.set(key, value);
    }
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (!upstreamResponse.ok) {
      return Response.json(
        { error: `Upstream error: ${upstreamResponse.status}` },
        { status: 502 }
      );
    }

    const data = await upstreamResponse.json();
    return Response.json(data, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Failed to reach upstream: ${message}` }, { status: 502 });
  }
}
