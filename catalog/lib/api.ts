import type { SearchResponse, PayloadResponse, DatasetMetadata } from "../types";
import {
  CATEGORIES,
  BROWSE_LIMIT_PER_CATEGORY,
  BROWSE_LIMIT_SINGLE,
  findCategory,
} from "./categories";

const DEFAULT_BYPASS_BASE_URL_SERVER = "http://localhost:8000";

function getSearchUrl(params: URLSearchParams): string {
  if (typeof window !== "undefined") {
    // クライアントサイド: Next.js プロキシ経由
    return `/api/search?${params.toString()}`;
  }
  // サーバーサイド: Lambda を直接呼び出し（Amplify SSR の自己呼び出し問題を回避）
  const bypassUrl = process.env.BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL_SERVER;
  return `${bypassUrl}/datasets/search?${params.toString()}`;
}

export async function searchDatasets(
  q: string,
  source?: string,
  limit = 20,
  offset = 0
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  if (source) {
    params.set("source", source);
  }

  const url = getSearchUrl(params);
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return response.json() as Promise<SearchResponse>;
}

export async function browseByCategory(categoryId: string): Promise<DatasetMetadata[]> {
  const category = findCategory(categoryId);

  if (category.id === "all") {
    const subCategories = CATEGORIES.filter((c) => c.id !== "all");
    const results = await Promise.all(
      subCategories.map((c) =>
        searchDatasets(c.keyword, undefined, BROWSE_LIMIT_PER_CATEGORY, 0)
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

  const result = await searchDatasets(category.keyword, undefined, BROWSE_LIMIT_SINGLE, 0);
  return result.items;
}

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

export async function getCredentialStatus(
  sourceId: string,
  accessToken?: string,
): Promise<boolean> {
  const baseUrl = process.env.BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
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

export async function fetchDataset(id: string): Promise<PayloadResponse> {
  const url = typeof window !== "undefined"
    ? `/api/datasets/${encodeURIComponent(id)}`
    : `${process.env.BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL_SERVER}/datasets/${encodeURIComponent(id)}/fetch`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Dataset fetch failed: ${response.status}`);
  }

  return response.json() as Promise<PayloadResponse>;
}
