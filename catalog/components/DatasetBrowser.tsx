"use client";

import { useEffect, useState } from "react";
import type { DatasetMetadata } from "../types";
import { SOURCE_LABELS } from "../types";
import DatasetCard from "./DatasetCard";
import DatasetListView from "./DatasetListView";
import ErrorRetry from "./ErrorRetry";
import SkeletonCard from "./SkeletonCard";
import { BROWSE_LIMIT_SINGLE } from "../lib/categories";

interface BrowseSection {
  source_id: string;
  items: DatasetMetadata[];
  total: number;
}

interface BrowseResponse {
  sections: BrowseSection[];
}

interface SearchResponse {
  items: DatasetMetadata[];
  total: number | null;
  has_next: boolean;
  page: number;
}

interface DatasetBrowserProps {
  category: string;
  page: number;
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 8 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SourceSection({ section }: { section: BrowseSection }) {
  const label = SOURCE_LABELS[section.source_id] ?? section.source_id;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
        <span className="text-sm text-gray-500">{section.total.toLocaleString()} 件</span>
      </div>
      {section.items.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">データなし</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {section.items.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DatasetBrowser({ category, page }: DatasetBrowserProps) {
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBrowseData(null);
    setSearchData(null);
    setError(false);

    const params = new URLSearchParams({ category, page: String(page) });
    fetch(`/api/browse?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (category === "all") {
          setBrowseData(json as BrowseResponse);
        } else {
          setSearchData(json as SearchResponse);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [category, page]);

  if (error) {
    return <ErrorRetry message="データの取得に失敗しました" />;
  }

  // category=all: ソース別セクション表示
  if (category === "all") {
    if (!browseData) return <SkeletonGrid />;

    return (
      <div>
        {browseData.sections.map((section) => (
          <SourceSection key={section.source_id} section={section} />
        ))}
      </div>
    );
  }

  // 個別カテゴリ: リスト表示
  if (!searchData) return <SkeletonGrid />;

  const totalPages = searchData.total !== null
    ? Math.ceil(searchData.total / BROWSE_LIMIT_SINGLE)
    : null;

  return (
    <DatasetListView
      items={searchData.items}
      totalPages={totalPages}
      hasNext={searchData.has_next}
      currentPage={page}
      basePath="/"
      queryParams={{ category }}
      gridCols={2}
    />
  );
}
