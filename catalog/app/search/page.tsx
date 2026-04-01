import { Suspense } from "react";
import SearchBar from "../../components/SearchBar";
import SourceFilterTabs from "../../components/SourceFilterTabs";
import SearchResults from "../../components/SearchResults";
import EStatBanner from "../../components/EStatBanner";
import SkeletonCard from "../../components/SkeletonCard";


interface SearchPageProps {
  searchParams: Promise<{ q?: string; source?: string; page?: string }>;
}

function SkeletonResults() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 5 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default async function SearchResultsPage({ searchParams }: SearchPageProps) {
  const { q = "", source = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <SearchBar initialQuery={q} />
      </div>
      <EStatBanner />
      <div className="mb-4">
        <SourceFilterTabs currentSource={source} currentQuery={q} />
      </div>
      <Suspense fallback={<SkeletonResults />}>
        <SearchResults q={q} source={source} page={page} />
      </Suspense>
    </main>
  );
}
