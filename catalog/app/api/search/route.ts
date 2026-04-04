import { type NextRequest } from "next/server";
import { searchCachedMetadata } from "../../../lib/s3-cache";

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const source = params.get("source") ?? undefined;
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10) || 20));
  const offset = Math.max(0, parseInt(params.get("offset") ?? "0", 10) || 0);

  if (!q.trim()) {
    return Response.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 },
    );
  }

  try {
    const result = await searchCachedMetadata(q, source, limit, offset);

    return Response.json({
      items: result.items,
      total: result.total,
      has_next: result.has_next,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Search failed: ${message}` }, { status: 502 });
  }
}
