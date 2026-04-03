/**
 * Source Registry — データソース定義の単一ソース
 *
 * Bypass の GET /sources から動的に取得し、失敗時はフォールバック定数を使用する。
 * 新しいデータソースを追加する場合は Bypass 側にコネクターを登録するだけでよい。
 */

import { z } from "zod";

export interface DataSource {
  /** ソース識別子（Bypass API の source_id と一致） */
  readonly id: string;
  /** UI 表示用ラベル */
  readonly label: string;
  /** API キーが必要かどうか */
  readonly requiresApiKey: boolean;
}

const DataSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  requires_api_key: z.boolean(),
});

const SourcesResponseSchema = z.array(DataSourceSchema);

/**
 * フォールバック用のソース定義。
 * Bypass が未接続の場合や GET /sources が失敗した場合に使用する。
 */
export const FALLBACK_SOURCES: readonly DataSource[] = [
  { id: "estat", label: "e-Stat", requiresApiKey: true },
  { id: "datagojp", label: "data.go.jp", requiresApiKey: false },
  { id: "egov_law", label: "e-Gov 法令", requiresApiKey: false },
  { id: "jma", label: "気象庁", requiresApiKey: false },
] as const;

/** @deprecated FALLBACK_SOURCES を使用してください。後方互換のため維持。 */
export const SOURCES = FALLBACK_SOURCES;

/** ソース ID のユニオン型 */
export type SourceId = string;

/** ソース ID → 表示ラベルのマッピング（フォールバック用） */
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  FALLBACK_SOURCES.map((s) => [s.id, s.label]),
);

const DEFAULT_BYPASS_BASE_URL = "http://localhost:8000";

/** Bypass API からソース定義を取得する。失敗時はフォールバックを返す。 */
export async function fetchSources(): Promise<readonly DataSource[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? DEFAULT_BYPASS_BASE_URL;
    const response = await fetch(`${baseUrl}/sources`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return FALLBACK_SOURCES;
    const json: unknown = await response.json();
    const parsed = SourcesResponseSchema.parse(json);
    return parsed.map((s) => ({
      id: s.id,
      label: s.label,
      requiresApiKey: s.requires_api_key,
    }));
  } catch {
    return FALLBACK_SOURCES;
  }
}

/** ソース ID から DataSource を検索する。見つからない場合は undefined。 */
export function findSource(id: string): DataSource | undefined {
  return FALLBACK_SOURCES.find((s) => s.id === id);
}

/** API キーが必要なソースのみ返す（フォールバック用の同期版）。 */
export function getSourcesRequiringApiKey(): readonly DataSource[] {
  return FALLBACK_SOURCES.filter((s) => s.requiresApiKey);
}

/** API キーが必要なソースのみ返す（Bypass 連携の非同期版）。 */
export async function fetchSourcesRequiringApiKey(): Promise<readonly DataSource[]> {
  const sources = await fetchSources();
  return sources.filter((s) => s.requiresApiKey);
}
