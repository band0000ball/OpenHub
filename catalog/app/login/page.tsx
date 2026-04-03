/**
 * ログインページ
 *
 * Cognito Hosted UI へリダイレクトする。
 * proxy.ts が /login?callbackUrl=/settings にリダイレクトし、
 * このページが signIn("cognito") を呼び出して OAuth フローを開始する。
 *
 * Note: サーバーサイド signIn() は Amplify SSR 環境で NEXT_REDIRECT の
 * ハンドリングに問題があるため、クライアントコンポーネントで実装する。
 */

"use client"

import { signIn } from "next-auth/react"
import { useEffect } from "react"

export default function LoginPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callbackUrl = params.get("callbackUrl") ?? "/"
    signIn("cognito", { callbackUrl })
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">ログイン画面へ移動中...</p>
    </main>
  )
}
