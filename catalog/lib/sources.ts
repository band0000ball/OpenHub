/**
 * Source Registry — データソース定義の単一ソース
 *
 * 全コンポーネントはこのレジストリからソース情報を取得する。
 * 新しいデータソースを追加するにはここに 1 エントリ追加するだけでよい。
 */

export interface DataSource {
  /** ソース識別子（Bypass API の source_id と一致） */
  readonly id: string;
  /** UI 表示用ラベル */
  readonly label: string;
  /** API キーが必要かどうか */
  readonly requiresApiKey: boolean;
}

/**
 * 登録済みデータソース一覧。
 * 新しいソースを追加する場合はここにエントリを追加する。
 */
export const SOURCES: readonly DataSource[] = [
  { id: "estat", label: "e-Stat", requiresApiKey: true },
  { id: "datagojp", label: "data.go.jp", requiresApiKey: false },
] as const;

/** ソース ID のユニオン型（SOURCES から自動導出） */
export type SourceId = (typeof SOURCES)[number]["id"];

/** ソース ID → 表示ラベルのマッピング */
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s.label]),
);

/** ソース ID から DataSource を検索する。見つからない場合は undefined。 */
export function findSource(id: string): DataSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** API キーが必要なソースのみ返す。 */
export function getSourcesRequiringApiKey(): readonly DataSource[] {
  return SOURCES.filter((s) => s.requiresApiKey);
}
