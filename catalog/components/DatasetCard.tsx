import Link from "next/link";
import type { DatasetMetadata } from "../types";
import { SOURCE_LABELS } from "../types";

interface DatasetCardProps {
  dataset: DatasetMetadata;
}

const MAX_TAGS = 3;

export default function DatasetCard({ dataset }: DatasetCardProps) {
  const visibleTags = dataset.tags.slice(0, MAX_TAGS);
  const sourceLabel = SOURCE_LABELS[dataset.source_id] ?? dataset.source_id;
  const detailHref = `/datasets/${encodeURIComponent(dataset.id)}`;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <Link href={detailHref} className="block">
        <h2 className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2">
          {dataset.title}
        </h2>
      </Link>

      <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          {sourceLabel}
        </span>
        <span>{dataset.updated_at}</span>
      </div>

      {visibleTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-sm text-gray-500 line-clamp-2">
        {dataset.description}
      </p>
    </article>
  );
}
