/**
 * S3 メタデータに対する in-memory キーワード検索。
 * 純粋関数 — 外部依存なし。
 */

import type { DatasetMetadata, SearchResponse } from "../types";

export function searchMetadata(
  items: DatasetMetadata[],
  query: string,
  source?: string,
  limit = 20,
  offset = 0,
): SearchResponse {
  let filtered = items;

  // source フィルタ
  if (source) {
    filtered = filtered.filter((item) => item.source_id === source);
  }

  // キーワードフィルタ（スペース区切りで AND マッチ）
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  if (keywords.length > 0) {
    filtered = filtered.filter((item) => {
      const text = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
      return keywords.every((kw) => text.includes(kw));
    });
  }

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);
  const has_next = offset + limit < total;

  return {
    items: paged,
    total,
    has_next,
    limit,
    offset,
  };
}
