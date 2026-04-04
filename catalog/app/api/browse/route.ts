import { type NextRequest } from "next/server";
import { searchCachedMetadata, browseCachedMetadata } from "../../../lib/s3-cache";
import {
  findCategory,
  CATEGORIES,
  BROWSE_LIMIT_PER_CATEGORY,
  BROWSE_LIMIT_SINGLE,
} from "../../../lib/categories";

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? "all";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  try {
    if (category === "all") {
      // 1回のリクエストで全カテゴリを取得
      const keywords = CATEGORIES
        .filter((c) => c.id !== "all")
        .map((c) => c.keyword);
      const result = await browseCachedMetadata(keywords, BROWSE_LIMIT_PER_CATEGORY);

      return Response.json({
        items: result.items,
        total: null,
        has_next: false,
        page: 1,
      });
    }

    const categoryInfo = findCategory(category);
    const offset = (page - 1) * BROWSE_LIMIT_SINGLE;
    const result = await searchCachedMetadata(
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
