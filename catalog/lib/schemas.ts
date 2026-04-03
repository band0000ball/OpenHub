/**
 * Zod スキーマ — Bypass API レスポンスの実行時バリデーション
 *
 * response.json() as T を安全な Zod パースに置き換える。
 * 不正なレスポンスはパースエラーとして即座に検出される。
 */

import { z } from "zod";

export const DatasetMetadataSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  tags: z.array(z.string()),
  updated_at: z.string(),
});

export const SearchResponseSchema = z.object({
  items: z.array(DatasetMetadataSchema),
  total: z.number().nullable(),
  has_next: z.boolean(),
  limit: z.number(),
  offset: z.number(),
});

export const PayloadResponseSchema = z.object({
  metadata: DatasetMetadataSchema,
  format: z.string(),
  fetched_at: z.string(),
  record_count: z.number().nullable(),
  data_encoding: z.enum(["utf-8", "base64"]),
  data: z.string(),
});
