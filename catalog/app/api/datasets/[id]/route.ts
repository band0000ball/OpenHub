import { type NextRequest } from "next/server";
import { getAccessToken } from "../../../../lib/auth-helpers";

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
  const upstreamUrl = `${baseUrl}/datasets/${id}/fetch`;

  const accessToken = await getAccessToken().catch(() => undefined);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, { headers });

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
