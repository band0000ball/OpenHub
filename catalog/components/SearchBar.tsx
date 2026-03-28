"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SearchBarProps {
  initialQuery?: string;
}

export default function SearchBar({ initialQuery }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery ?? urlQuery);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ q: trimmed });
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} role="search" className="flex gap-2 w-full">
      <input
        type="search"
        role="searchbox"
        aria-label="データセットを検索"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="データセットを検索..."
        className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
      <button
        type="submit"
        aria-label="検索"
        className="rounded-lg bg-blue-600 px-5 py-2 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        検索
      </button>
    </form>
  );
}
