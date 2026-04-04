"use client";

import { useEffect, useState } from "react";
import type { DatasetMetadata } from "../types";
import DatasetListView from "./DatasetListView";
import ErrorRetry from "./ErrorRetry";
import SkeletonCard from "./SkeletonCard";
import { BROWSE_LIMIT_SINGLE } from "../lib/categories";

interface BrowseResponse {
  items: DatasetMetadata[];
  total: number | null;
  has_next: boolean;
  page: number;
  error?: string;
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

export default function DatasetBrowser({ category, page }: DatasetBrowserProps) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);

    const params = new URLSearchParams({ category, page: String(page) });
    fetch(`/api/browse?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<BrowseResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [category, page]);

  if (error) {
    return <ErrorRetry message="データの取得に失敗しました" />;
  }

  if (!data) {
    return <SkeletonGrid />;
  }

  const totalPages = data.total !== null
    ? Math.ceil(data.total / BROWSE_LIMIT_SINGLE)
    : null;

  return (
    <DatasetListView
      items={data.items}
      totalPages={totalPages}
      hasNext={data.has_next}
      currentPage={page}
      basePath="/"
      queryParams={{ category }}
      gridCols={2}
    />
  );
}
