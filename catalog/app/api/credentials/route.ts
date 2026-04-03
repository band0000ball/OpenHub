import { getAccessToken } from "../../../lib/auth-helpers";

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

export async function POST(request: Request): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;

  const accessToken = await getAccessToken();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const upstreamResponse = await fetch(`${baseUrl}/auth/credentials`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
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
