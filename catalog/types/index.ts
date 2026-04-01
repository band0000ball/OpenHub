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

export type SourceId = "estat" | "datagojp";

export const SOURCE_LABELS: Record<string, string> = {
  estat: "e-Stat",
  datagojp: "data.go.jp",
};
