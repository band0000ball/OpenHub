/**
 * DatasetListView — データセット一覧の共通表示コンポーネント
 *
 * DatasetBrowser と SearchResults の重複パターン（fetch → 空状態 → カード → ページネーション → エラー）
 * を集約する。データ取得は呼び出し元が行い、このコンポーネントは表示に専念する。
 */

import type { DatasetMetadata } from "../types";
import DatasetCard from "./DatasetCard";
import Pagination from "./Pagination";

interface DatasetListViewProps {
  items: DatasetMetadata[];
  totalPages: number | null;
  hasNext: boolean;
  currentPage: number;
  basePath: string;
  queryParams: Record<string, string>;
  emptyMessage?: string;
  gridCols?: 1 | 2;
}

export default function DatasetListView({
  items,
  totalPages,
  hasNext,
  currentPage,
  basePath,
  queryParams,
  emptyMessage = "データセットが見つかりませんでした",
  gridCols = 1,
}: DatasetListViewProps) {
  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-gray-500">{emptyMessage}</p>
    );
  }

  const gridClass = gridCols === 2 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4";

  return (
    <div>
      <div className={gridClass}>
        {items.map((dataset) => (
          <DatasetCard key={dataset.id} dataset={dataset} />
        ))}
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        hasNext={hasNext}
        basePath={basePath}
        queryParams={queryParams}
      />
    </div>
  );
}
