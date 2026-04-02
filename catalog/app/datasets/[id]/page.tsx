import Link from "next/link";
import { auth } from "../../../auth";
import { fetchDataset } from "../../../lib/api";
import { SOURCE_LABELS } from "../../../types";

interface DatasetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DatasetDetailPage({ params }: DatasetDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  try {
    const payload = await fetchDataset(id, accessToken);
    const { metadata } = payload;
    const sourceLabel = SOURCE_LABELS[metadata.source_id] ?? metadata.source_id;

    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-6">
          <Link
            href="/search"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            ← 検索結果に戻る
          </Link>
        </nav>

        <article>
          <h1 className="text-2xl font-bold text-gray-900">{metadata.title}</h1>

          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {sourceLabel}
            </span>
            <span>{metadata.updated_at}</span>
          </div>

          {metadata.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {metadata.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 leading-relaxed text-gray-700">{metadata.description}</p>

          <div className="mt-6">
            <a
              href={metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${metadata.title}（新しいタブで開く）`}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              元データを見る
            </a>
          </div>
        </article>
      </main>
    );
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-6">
          <Link
            href="/search"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            ← 検索結果に戻る
          </Link>
        </nav>
        <p role="alert" className="py-8 text-center text-red-600">
          データセットの取得に失敗しました。再試行してください
        </p>
      </main>
    );
  }
}
