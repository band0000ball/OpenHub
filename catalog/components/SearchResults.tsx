import DatasetCard from "./DatasetCard";
import { searchDatasets } from "../lib/api";

interface SearchResultsProps {
  q: string;
  source: string;
}

export default async function SearchResults({ q, source }: SearchResultsProps) {
  try {
    const results = await searchDatasets(q, source || undefined, 20, 0);

    if (results.items.length === 0) {
      return (
        <p className="py-12 text-center text-gray-500">
          該当するデータセットが見つかりませんでした
        </p>
      );
    }

    return (
      <div>
        <p className="mb-4 text-sm text-gray-500">
          {results.total} 件のデータセットが見つかりました
        </p>
        <div className="grid gap-4">
          {results.items.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
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
