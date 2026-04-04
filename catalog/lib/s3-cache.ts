/**
 * キャッシュクライアント。
 * Bypass の /cache/metadata エンドポイント経由でメタデータを検索する。
 * Bypass 側でフィルタリング・ページネーション済みの結果を返す。
 */

import type { DatasetMetadata, SearchResponse } from "../types";

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

function getBypassUrl(): string {
  return process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
}

export async function searchCachedMetadata(
  q: string,
  source?: string,
  limit = 20,
  offset = 0,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    offset: String(offset),
  });
  if (source) params.set("source", source);

  try {
    const response = await fetch(
      `${getBypassUrl()}/cache/metadata?${params.toString()}`,
    );
    if (!response.ok) {
      throw new Error(`Cache API returned ${response.status}`);
    }
    return (await response.json()) as SearchResponse;
  } catch {
    return { items: [], total: 0, has_next: false, limit, offset };
  }
}

export async function browseCachedMetadata(
  keywords: string[],
  limitPer = 4,
): Promise<{ items: DatasetMetadata[]; total: number }> {
  try {
    const response = await fetch(
      `${getBypassUrl()}/cache/browse?categories=${encodeURIComponent(keywords.join(","))}&limit_per=${limitPer}`,
    );
    if (!response.ok) {
      throw new Error(`Browse API returned ${response.status}`);
    }
    return (await response.json()) as { items: DatasetMetadata[]; total: number };
  } catch {
    return { items: [], total: 0 };
  }
}

export async function getLastUpdated(): Promise<string | null> {
  try {
    const response = await fetch(`${getBypassUrl()}/cache/last_updated`);
    if (!response.ok) return null;
    const json = (await response.json()) as { last_updated: string };
    return json.last_updated;
  } catch {
    return null;
  }
}
