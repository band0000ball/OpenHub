import DatasetListView from "./DatasetListView";
import { searchDatasets } from "../lib/api";

const LIMIT = 20;

interface SearchResultsProps {
  q: string;
  source: string;
  page: number;
  accessToken?: string;
}

export default async function SearchResults({ q, source, page, accessToken }: SearchResultsProps) {
  const offset = (page - 1) * LIMIT;

  try {
    const results = await searchDatasets(q, source || undefined, LIMIT, offset, accessToken);

    const totalPages = results.total !== null
      ? Math.ceil(results.total / LIMIT)
      : null;

    const queryParams: Record<string, string> = { q };
    if (source) queryParams.source = source;

    return (
      <div>
        {results.items.length > 0 && (
          <p className="mb-4 text-sm text-gray-500">
            {results.total !== null
              ? `${results.total} 件のデータセットが見つかりました`
              : "データセットが見つかりました"}
          </p>
        )}
        <DatasetListView
          items={results.items}
          totalPages={totalPages}
          hasNext={results.has_next}
          currentPage={page}
          basePath="/search"
          queryParams={queryParams}
          emptyMessage="該当するデータセットが見つかりませんでした"
        />
      </div>
    );
  } catch {
    return (
      <p role="alert" className="py-8 text-center text-red-600">
        検索に失敗しました。再試行してください
      </p>
    );
  }
}
