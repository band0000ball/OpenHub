/**
 * キャッシュクライアント。
 * Bypass の /cache エンドポイント経由でメタデータを検索・ブラウズする。
 */

import type { DatasetMetadata, SearchResponse } from "../types";

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

function getBypassUrl(): string {
  return process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
}

export interface BrowseSection {
  source_id: string;
  items: DatasetMetadata[];
  total: number;
}

export interface BrowseResponse {
  sections: BrowseSection[];
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
  limitPer = 5,
): Promise<BrowseResponse> {
  try {
    const response = await fetch(
      `${getBypassUrl()}/cache/browse?limit_per=${limitPer}`,
    );
    if (!response.ok) {
      throw new Error(`Browse API returned ${response.status}`);
    }
    return (await response.json()) as BrowseResponse;
  } catch {
    return { sections: [] };
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
