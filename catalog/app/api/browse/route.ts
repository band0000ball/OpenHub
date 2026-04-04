import { type NextRequest } from "next/server";
import { browseByCategory, searchDatasets } from "../../../lib/api";
import { findCategory, BROWSE_LIMIT_SINGLE } from "../../../lib/categories";
import { getAccessToken } from "../../../lib/auth-helpers";

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? "all";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const accessToken = await getAccessToken().catch(() => undefined);

  try {
    if (category === "all") {
      const items = await browseByCategory("all", accessToken);
      return Response.json({
        items,
        total: null,
        has_next: false,
        page: 1,
      });
    }

    const categoryInfo = findCategory(category);
    const offset = (page - 1) * BROWSE_LIMIT_SINGLE;
    const result = await searchDatasets(
      categoryInfo.keyword,
      undefined,
      BROWSE_LIMIT_SINGLE,
      offset,
      accessToken,
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
