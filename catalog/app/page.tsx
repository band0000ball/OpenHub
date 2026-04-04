import SearchBar from "../components/SearchBar";
import CategoryTabs from "../components/CategoryTabs";
import DatasetBrowser from "../components/DatasetBrowser";
import CredentialsBanner from "../components/CredentialsBanner";

interface HomePageProps {
  searchParams: Promise<{ category?: string; page?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { category = "all", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

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
          <SearchBar />
        </div>
      </div>

      <div className="mx-auto max-w-5xl w-full px-4 py-8">
        <CredentialsBanner />
        <CategoryTabs currentCategory={category} />
        <DatasetBrowser category={category} page={page} />
      </div>
    </main>
  );
}
