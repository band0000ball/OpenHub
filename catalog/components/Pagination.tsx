import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number | null;
  hasNext: boolean;
  basePath: string;
  queryParams: Record<string, string>;
}

function buildUrl(
  basePath: string,
  params: Record<string, string>,
  page: number
): string {
  const searchParams = new URLSearchParams({ ...params, page: String(page) });
  return `${basePath}?${searchParams.toString()}`;
}

export default function Pagination({
  currentPage,
  totalPages,
  hasNext,
  basePath,
  queryParams,
}: PaginationProps) {
  const safePage = Math.max(1, currentPage);
  const hasPrev = safePage > 1;
  const isLastPage = totalPages !== null
    ? safePage >= totalPages
    : !hasNext;

  return (
    <nav aria-label="ページネーション" className="mt-6 flex items-center justify-center gap-2">
      {hasPrev ? (
        <Link
          href={buildUrl(basePath, queryParams, safePage - 1)}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          前へ
        </Link>
      ) : (
        <span className="rounded border border-gray-200 px-3 py-1 text-sm text-gray-300">
          前へ
        </span>
      )}

      {totalPages !== null && (
        <span className="text-sm text-gray-600">
          {safePage} / {totalPages} ページ
        </span>
      )}

      {!isLastPage ? (
        <Link
          href={buildUrl(basePath, queryParams, safePage + 1)}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          次へ
        </Link>
      ) : (
        <span className="rounded border border-gray-200 px-3 py-1 text-sm text-gray-300">
          次へ
        </span>
      )}
    </nav>
  );
}
