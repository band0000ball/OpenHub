/**
 * CredentialsBanner — API キー未設定のデータソースに対する警告バナー
 *
 * Source Registry の requiresApiKey ソースを自動検出し、
 * 未設定のソースがあれば設定ページへ誘導するバナーを表示する。
 */

import Link from "next/link";
import { getAccessToken } from "../lib/auth-helpers";
import { getCredentialStatus } from "../lib/api";
import { fetchSourcesRequiringApiKey } from "../lib/sources";

export default async function CredentialsBanner() {
  const accessToken = await getAccessToken().catch(() => undefined);
  const sources = await fetchSourcesRequiringApiKey();

  // 全ての requiresApiKey ソースの設定状態を並列チェック
  const statuses = await Promise.all(
    sources.map(async (source) => ({
      source,
      configured: await getCredentialStatus(source.id, accessToken),
    })),
  );

  const unconfigured = statuses.filter((s) => !s.configured);
  if (unconfigured.length === 0) return null;

  const names = unconfigured.map((s) => s.source.label).join("・");

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
