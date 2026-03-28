import DatasetCard from "./DatasetCard";
import { browseByCategory } from "../lib/api";

interface DatasetBrowserProps {
  category: string;
}

export default async function DatasetBrowser({ category }: DatasetBrowserProps) {
  try {
    const datasets = await browseByCategory(category);

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
  } catch {
    return (
      <p role="alert" className="py-8 text-center text-red-600">
        データの取得に失敗しました。再試行してください
      </p>
    );
  }
}
