/**
 * キャッシュクライアント。
 * Bypass の /cache/metadata?source=xxx エンドポイント経由で
 * ソース別にメタデータを並列取得し統合する。
 * in-memory キャッシュ（TTL 5分）で保持。
 */

import type { DatasetMetadata } from "../types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分
const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";
const SOURCE_IDS = ["estat", "datagojp", "egov_law", "jma"] as const;

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

let metadataCache: CacheEntry<DatasetMetadata[]> | null = null;

function getBypassUrl(): string {
  return process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
}

async function fetchSourceMetadata(sourceId: string): Promise<DatasetMetadata[]> {
  try {
    const response = await fetch(
      `${getBypassUrl()}/cache/metadata?source=${sourceId}`,
    );
    if (!response.ok) return [];
    const json = (await response.json()) as { items: DatasetMetadata[] };
    return json.items;
  } catch {
    return [];
  }
}

export async function getMetadata(): Promise<DatasetMetadata[]> {
  const now = Date.now();

  if (metadataCache && metadataCache.expiry > now) {
    return metadataCache.data;
  }

  const results = await Promise.all(
    SOURCE_IDS.map((id) => fetchSourceMetadata(id)),
  );
  const allItems = results.flat();

  metadataCache = { data: allItems, expiry: now + CACHE_TTL_MS };
  return allItems;
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

/** テスト用: in-memory キャッシュをクリアする */
export function clearCache(): void {
  metadataCache = null;
}
