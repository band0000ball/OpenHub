/**
 * ログインページ
 *
 * NextAuth.js の signIn("cognito") を呼び出して Cognito Hosted UI へリダイレクトする。
 * ユーザーが直接 /login にアクセスした場合や、
 * proxy.ts が未認証アクセスをリダイレクトした場合に表示される。
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
