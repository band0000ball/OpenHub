/**
 * Next.js Proxy（旧 Middleware）— 認証ガード
 *
 * /settings 以下へのアクセスを認証済みユーザーのみに制限する。
 * 未認証の場合は /login へリダイレクトして Cognito Hosted UI に誘導する。
 *
 * Note: Next.js 16 から middleware.ts は deprecated になり proxy.ts に改名。
 * next-auth の `auth` Proxy ラッパーを使用して req.auth でセッション状態を参照する。
 */

import { NextResponse } from "next/server"
import { auth } from "./auth"

export default auth((req) => {
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }
  // 認証済み → パススルー（何も返さない）
})

export const config = {
  matcher: ["/settings/:path*"],
}
