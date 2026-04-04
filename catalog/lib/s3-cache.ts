/**
 * S3 キャッシュクライアント。
 * metadata.json を S3 から取得し、in-memory キャッシュ（TTL 5分）で保持する。
 */

import type { DatasetMetadata } from "../types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

let metadataCache: CacheEntry<DatasetMetadata[]> | null = null;

async function getS3Json<T>(key: string): Promise<T> {
  const bucketName = process.env.CACHE_BUCKET_NAME ?? "";
  if (!bucketName) {
    throw new Error("CACHE_BUCKET_NAME is not configured");
  }

  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({});
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  const response = await s3.send(command);
  const body = await response.Body!.transformToString();
  return JSON.parse(body) as T;
}

export async function getMetadata(): Promise<DatasetMetadata[]> {
  const now = Date.now();

  if (metadataCache && metadataCache.expiry > now) {
    return metadataCache.data;
  }

  try {
    const json = await getS3Json<{ count: number; items: DatasetMetadata[] }>(
      "catalog/metadata.json",
    );
    metadataCache = { data: json.items, expiry: now + CACHE_TTL_MS };
    return json.items;
  } catch {
    return [];
  }
}

export async function getLastUpdated(): Promise<string | null> {
  try {
    const json = await getS3Json<{ last_updated: string }>(
      "catalog/last_updated.json",
    );
    return json.last_updated;
  } catch {
    return null;
  }
}

/** テスト用: in-memory キャッシュをクリアする */
export function clearCache(): void {
  metadataCache = null;
}
