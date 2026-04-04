import { type NextRequest } from "next/server";
import { getMetadata } from "../../../lib/s3-cache";
import { searchMetadata } from "../../../lib/search";
import { findCategory, BROWSE_LIMIT_SINGLE } from "../../../lib/categories";

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? "all";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  try {
    const allItems = await getMetadata();

    if (category === "all") {
      return Response.json({
        items: allItems,
        total: allItems.length,
        has_next: false,
        page: 1,
      });
    }

    const categoryInfo = findCategory(category);
    const offset = (page - 1) * BROWSE_LIMIT_SINGLE;
    const result = searchMetadata(
      allItems,
      categoryInfo.keyword,
      undefined,
      BROWSE_LIMIT_SINGLE,
      offset,
    );

    return Response.json({
      items: result.items,
      total: result.total,
      has_next: result.has_next,
      page,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Browse failed: ${message}` }, { status: 502 });
  }
}
