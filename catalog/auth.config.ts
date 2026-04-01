/**
 * NextAuth.js v5 — Edge-safe 設定
 *
 * proxy.ts（middleware）は Edge Runtime で動作するため、
 * requireEnv など Node.js 専用 API をモジュール評価時に呼べない。
 * この設定ファイルはプロバイダー詳細を持たず、JWT セッションの
 * 確認のみを行う最小構成にすることで Edge Runtime に対応する。
 *
 * プロバイダー詳細（Cognito エンドポイント等）は auth.ts に記述する。
 */

import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  /**
   * trustHost: Amplify は X-Forwarded-Host を設定するため、
   * reverse proxy 配下では必須。
   */
  trustHost: true,
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      if (account?.access_token) {
        return { ...token, accessToken: account.access_token }
      }
      return token
    },
    session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
      }
    },
  },
}