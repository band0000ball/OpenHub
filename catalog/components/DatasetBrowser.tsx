import DatasetCard from "./DatasetCard";
import Pagination from "./Pagination";
import { browseByCategory, searchDatasets } from "../lib/api";
import { findCategory, BROWSE_LIMIT_SINGLE } from "../lib/categories";

interface DatasetBrowserProps {
  category: string;
  page: number;
}

export default async function DatasetBrowser({ category, page }: DatasetBrowserProps) {
  try {
    // "all" カテゴリは複数ソースの並列フェッチのためページネーション非対応
    if (category === "all") {
      const datasets = await browseByCategory("all");

      if (datasets.length === 0) {
        return (
          <p className="py-12 text-center text-gray-500">
            データセットが見つかりませんでした
          </p>
        );
      }

      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {datasets.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
      );
    }

    // 個別カテゴリ: offset 付きで検索してページネーション表示
    const categoryInfo = findCategory(category);
    const offset = (page - 1) * BROWSE_LIMIT_SINGLE;
    const result = await searchDatasets(categoryInfo.keyword, undefined, BROWSE_LIMIT_SINGLE, offset);

    if (result.items.length === 0) {
      return (
        <p className="py-12 text-center text-gray-500">
          データセットが見つかりませんでした
        </p>
      );
    }

    const totalPages = result.total !== null
      ? Math.ceil(result.total / BROWSE_LIMIT_SINGLE)
      : null;

    return (
      <div>
        <div className="grid gap-4 sm:grid-cols-2">
          {result.items.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          hasNext={result.has_next}
          basePath="/"
          queryParams={{ category }}
        />
      </div>
    );
  } catch {
    return (
      <p role="alert" className="py-8 text-center text-red-600">
        データの取得に失敗しました。再試行してください
      </p>
    );
  }
}
