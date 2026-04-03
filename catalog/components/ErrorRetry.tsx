"use client";

import { useRouter } from "next/navigation";

interface ErrorRetryProps {
  message?: string;
}

export default function ErrorRetry({
  message = "データの取得に失敗しました",
}: ErrorRetryProps) {
  const router = useRouter();

  return (
    <div role="alert" className="py-8 text-center">
      <p className="mb-3 text-red-600">{message}</p>
      <button
        onClick={() => router.refresh()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        再試行
      </button>
    </div>
  );
}
