import type { SearchResponse, PayloadResponse, DatasetMetadata } from "../types";
import {
  CATEGORIES,
  BROWSE_LIMIT_PER_CATEGORY,
  BROWSE_LIMIT_SINGLE,
  findCategory,
} from "./categories";
import { SearchResponseSchema, PayloadResponseSchema } from "./schemas";

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

/** 検索結果のキャッシュ有効期間（秒）。行政データは日次〜月次更新のため 1 分で十分。 */
const SEARCH_REVALIDATE = 60;
/** カテゴリ一覧・データセット詳細のキャッシュ有効期間（秒）。更新頻度が低いため 5 分。 */
const BROWSE_REVALIDATE = 300;

function getSearchUrl(params: URLSearchParams): string {
  if (typeof window !== "undefined") {
    // クライアントサイド: Next.js プロキシ経由
    return `/api/search?${params.toString()}`;
  }
  // サーバーサイド: Lambda を直接呼び出し（Amplify SSR の自己呼び出し問題を回避）
  const bypassUrl = process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
  return `${bypassUrl}/datasets/search?${params.toString()}`;
}

function buildHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function searchDatasets(
  q: string,
  source?: string,
  limit = 20,
  offset = 0,
  accessToken?: string,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  if (source) {
    params.set("source", source);
  }

  const url = getSearchUrl(params);
  const response = await fetch(url, {
    next: { revalidate: SEARCH_REVALIDATE },
    headers: buildHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const json: unknown = await response.json();
  return SearchResponseSchema.parse(json);
}

export async function browseByCategory(
  categoryId: string,
  accessToken?: string,
): Promise<DatasetMetadata[]> {
  const category = findCategory(categoryId);

  if (category.id === "all") {
    const subCategories = CATEGORIES.filter((c) => c.id !== "all");
    const results = await Promise.all(
      subCategories.map((c) =>
        searchDatasets(c.keyword, undefined, BROWSE_LIMIT_PER_CATEGORY, 0, accessToken)
          .then((r) => r.items)
          .catch((): DatasetMetadata[] => [])
      )
    );
    const seen = new Set<string>();
    return results.flat().filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }

  const result = await searchDatasets(category.keyword, undefined, BROWSE_LIMIT_SINGLE, 0, accessToken);
  return result.items;
}

export async function getCredentialStatus(
  sourceId: string,
  accessToken?: string,
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  try {
    const response = await fetch(
      `${baseUrl}/auth/credentials/${encodeURIComponent(sourceId)}/status`,
      { cache: "no-store", headers },
    );
    if (!response.ok) return false;
    const data = (await response.json()) as { configured: boolean };
    return data.configured;
  } catch {
    return false;
  }
}

export async function fetchDataset(id: string, accessToken?: string): Promise<PayloadResponse> {
  const url = typeof window !== "undefined"
    ? `/api/datasets/${encodeURIComponent(id)}`
    : `${process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL}/datasets/${encodeURIComponent(id)}/fetch`;
  const response = await fetch(url, {
    next: { revalidate: BROWSE_REVALIDATE },
    headers: buildHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(`Dataset fetch failed: ${response.status}`);
  }

  const json: unknown = await response.json();
  return PayloadResponseSchema.parse(json);
}
