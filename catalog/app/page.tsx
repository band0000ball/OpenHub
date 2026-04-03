import { Suspense } from "react";
import { getAccessToken } from "../lib/auth-helpers";
import SearchBar from "../components/SearchBar";
import CategoryTabs from "../components/CategoryTabs";
import DatasetBrowser from "../components/DatasetBrowser";
import EStatBanner from "../components/EStatBanner";
import SkeletonCard from "../components/SkeletonCard";

interface HomePageProps {
  searchParams: Promise<{ category?: string; page?: string }>;
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

export default async function HomePage({ searchParams }: HomePageProps) {
  const { category = "all", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const accessToken = await getAccessToken();

  return (
    <main className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-center text-3xl font-bold text-gray-900">
            OpenHub カタログ
          </h1>
          <p className="mb-6 text-center text-gray-500">
            e-Stat・data.go.jp のデータセットをまとめて検索できます
          </p>
          <Suspense
            fallback={
              <div className="h-12 w-full animate-pulse rounded-lg bg-gray-200" />
            }
          >
            <SearchBar />
          </Suspense>
        </div>
      </div>

      <div className="mx-auto max-w-5xl w-full px-4 py-8">
        <Suspense fallback={null}>
          <EStatBanner />
        </Suspense>
        <CategoryTabs currentCategory={category} />
        <Suspense fallback={<SkeletonGrid />}>
          <DatasetBrowser category={category} page={page} accessToken={accessToken} />
        </Suspense>
      </div>
    </main>
  );
}
