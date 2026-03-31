/**
 * NextAuth.js v5 設定
 *
 * AWS Cognito User Pool を OAuth 2.0 / PKCE プロバイダーとして使用する。
 * セッション戦略: JWT（サーバーレス対応）
 * accessToken を session に含めて Bypass の Bearer トークンとして使用する。
 *
 * 必要な環境変数（.env.local）:
 *   AUTH_COGNITO_ID     = <Cognito App Client ID>
 *   AUTH_COGNITO_SECRET = （Public client は空文字）
 *   AUTH_COGNITO_ISSUER = https://cognito-idp.<region>.amazonaws.com/<UserPoolId>
 *   AUTH_SECRET         = <ランダム文字列: `openssl rand -base64 32`>
 */

import NextAuth from "next-auth"
import Cognito from "next-auth/providers/cognito"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Cognito({
      clientId: process.env.AUTH_COGNITO_ID!,
      clientSecret: process.env.AUTH_COGNITO_SECRET ?? "",
      issuer: process.env.AUTH_COGNITO_ISSUER,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      // 初回ログイン時に access_token を token に保存する
      if (account?.access_token) {
        return { ...token, accessToken: account.access_token }
      }
      return token
    },
    session({ session, token }) {
      // accessToken をセッションに含めて Client / Server Component から参照可能にする
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
      }
    },
  },
  pages: {
    signIn: "/login",
  },
})
