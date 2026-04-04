/**
 * キャッシュクライアント。
 * Bypass の /cache/metadata エンドポイント経由で S3 のメタデータを取得する。
 * in-memory キャッシュ（TTL 5分）で保持。
 */

import type { DatasetMetadata } from "../types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分
const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

let metadataCache: CacheEntry<DatasetMetadata[]> | null = null;

function getBypassUrl(): string {
  return process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
}

export async function getMetadata(): Promise<DatasetMetadata[]> {
  const now = Date.now();

  if (metadataCache && metadataCache.expiry > now) {
    return metadataCache.data;
  }

  try {
    const response = await fetch(`${getBypassUrl()}/cache/metadata`);
    if (!response.ok) {
      throw new Error(`Cache API returned ${response.status}`);
    }
    const json = (await response.json()) as { count: number; items: DatasetMetadata[] };
    metadataCache = { data: json.items, expiry: now + CACHE_TTL_MS };
    return json.items;
  } catch {
    return [];
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

/** テスト用: in-memory キャッシュをクリアする */
export function clearCache(): void {
  metadataCache = null;
}
