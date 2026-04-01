import Link from "next/link";
import { auth } from "../auth";
import { getCredentialStatus } from "../lib/api";

export default async function EStatBanner() {
  let session = null;
  try {
    session = await auth();
  } catch {
    // auth() が throw しても画面クラッシュさせない（RSC ナビゲーション保護）
  }
  const configured = await getCredentialStatus("estat", session?.accessToken);
  if (configured) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
    >
      <p>
        e-Stat のデータを表示するには{" "}
        <strong>アプリケーションID</strong> の設定が必要です。
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
