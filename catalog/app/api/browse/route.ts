import { type NextRequest } from "next/server";
import { searchCachedMetadata } from "../../../lib/s3-cache";
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
      // 各カテゴリから数件ずつ並列取得して統合
      const subCategories = CATEGORIES.filter((c) => c.id !== "all");
      const results = await Promise.all(
        subCategories.map((c) =>
          searchCachedMetadata(c.keyword, undefined, BROWSE_LIMIT_PER_CATEGORY, 0),
        ),
      );

      const seen = new Set<string>();
      const browseItems = results
        .flatMap((r) => r.items)
        .filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

      return Response.json({
        items: browseItems,
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
