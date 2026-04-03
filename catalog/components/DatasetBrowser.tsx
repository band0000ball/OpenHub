import DatasetListView from "./DatasetListView";
import { browseByCategory, searchDatasets } from "../lib/api";
import { findCategory, BROWSE_LIMIT_SINGLE } from "../lib/categories";

interface DatasetBrowserProps {
  category: string;
  page: number;
  accessToken?: string;
}

export default async function DatasetBrowser({ category, page, accessToken }: DatasetBrowserProps) {
  try {
    // "all" カテゴリは複数ソースの並列フェッチのためページネーション非対応
    if (category === "all") {
      const datasets = await browseByCategory("all", accessToken);
      return (
        <DatasetListView
          items={datasets}
          totalPages={null}
          hasNext={false}
          currentPage={1}
          basePath="/"
          queryParams={{ category }}
          gridCols={2}
        />
      );
    }

    // 個別カテゴリ: offset 付きで検索してページネーション表示
    const categoryInfo = findCategory(category);
    const offset = (page - 1) * BROWSE_LIMIT_SINGLE;
    const result = await searchDatasets(categoryInfo.keyword, undefined, BROWSE_LIMIT_SINGLE, offset, accessToken);

    const totalPages = result.total !== null
      ? Math.ceil(result.total / BROWSE_LIMIT_SINGLE)
      : null;

    return (
      <DatasetListView
        items={result.items}
        totalPages={totalPages}
        hasNext={result.has_next}
        currentPage={page}
        basePath="/"
        queryParams={{ category }}
        gridCols={2}
      />
    );
  } catch {
    return (
      <p role="alert" className="py-8 text-center text-red-600">
        データの取得に失敗しました。再試行してください
      </p>
    );
  }
}
