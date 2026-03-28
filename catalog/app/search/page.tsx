import { Suspense } from "react";
import SearchBar from "../../components/SearchBar";
import SourceFilterTabs from "../../components/SourceFilterTabs";
import SearchResults from "../../components/SearchResults";
import SkeletonCard from "../../components/SkeletonCard";


interface SearchPageProps {
  searchParams: Promise<{ q?: string; source?: string }>;
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
  const { q = "", source = "" } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <SearchBar initialQuery={q} />
      </div>
      <div className="mb-4">
        <SourceFilterTabs currentSource={source} currentQuery={q} />
      </div>
      <Suspense fallback={<SkeletonResults />}>
        <SearchResults q={q} source={source} />
      </Suspense>
    </main>
  );
}
