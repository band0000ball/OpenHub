export interface DatasetMetadata {
  id: string;
  source_id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  updated_at: string;
}

export interface SearchResponse {
  items: DatasetMetadata[];
  total: number | null;
  has_next: boolean;
  limit: number;
  offset: number;
}

export interface PayloadResponse {
  metadata: DatasetMetadata;
  format: string;
  fetched_at: string;
  record_count: number | null;
  data_encoding: "utf-8" | "base64";
  data: string;
}

// Source Registry から re-export（後方互換性のため維持）
export { SOURCE_LABELS } from "../lib/sources";
export type { SourceId } from "../lib/sources";
