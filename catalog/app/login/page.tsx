/**
 * ログインページ（サーバーサイドリダイレクト）
 *
 * クライアント JS を読み込まずに即座に Cognito へリダイレクトする。
 * proxy.ts が /login?callbackUrl=/settings にリダイレクトし、
 * このページがサーバーサイドで signIn() を実行して Cognito OAuth フローを開始する。
 */

import { signIn } from "../../auth"

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl = "/" } = await searchParams;
  // サーバーサイド signIn: 内部で NEXT_REDIRECT を throw して Cognito へリダイレクト
  await signIn("cognito", { redirectTo: callbackUrl });
}
