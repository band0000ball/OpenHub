"use client";

/**
 * CredentialsBanner — API キー未設定のデータソースに対する警告バナー
 *
 * クライアントサイドで /api/credentials/status を呼び出し、
 * 未設定のソースがあれば設定ページへ誘導するバナーを表示する。
 * ページ描画をブロックしない。
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface UnconfiguredSource {
  id: string;
  label: string;
  configured: boolean;
}

interface StatusResponse {
  unconfigured: UnconfiguredSource[];
}

export default function CredentialsBanner() {
  const [names, setNames] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/credentials/status")
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<StatusResponse>;
      })
      .then((data) => {
        if (data && data.unconfigured.length > 0) {
          setNames(data.unconfigured.map((s) => s.label).join("・"));
        }
      })
      .catch(() => {
        // サイレントに失敗 — バナー非表示
      });
  }, []);

  if (!names) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
    >
      <p>
        {names} のデータを表示するには{" "}
        <strong>アプリケーションID</strong> の設定が必要です。{" "}
        <Link
          href="/settings#estat-guide"
          className="underline hover:text-yellow-900"
        >
          取得方法はこちら
        </Link>
      </p>
      <Link
        href="/settings"
        className="ml-4 shrink-0 rounded bg-yellow-700 px-3 py-1 text-white hover:bg-yellow-800"
      >
        設定ページへ →
      </Link>
    </div>
  );
}
