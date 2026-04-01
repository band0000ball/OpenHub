/**
 * NextAuth.js v5 設定
 *
 * AWS Cognito User Pool を OAuth 2.0 プロバイダーとして使用する。
 * OIDC auto-discovery（Lambda で失敗する）を回避するため、エンドポイントを明示指定。
 * セッション戦略: JWT（サーバーレス対応）
 * accessToken を session に含めて Bypass の Bearer トークンとして使用する。
 *
 * 必要な環境変数:
 *   AUTH_COGNITO_ID      = <Cognito App Client ID>
 *   AUTH_COGNITO_SECRET  = <Cognito App Client Secret>
 *   AUTH_COGNITO_ISSUER  = https://cognito-idp.<region>.amazonaws.com/<UserPoolId>
 *   AUTH_COGNITO_DOMAIN  = https://<prefix>.auth.<region>.amazoncognito.com
 *   AUTH_SECRET          = <ランダム文字列>
 */

import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

/**
 * 必須環境変数を取得する。未設定の場合はリクエスト時にエラーをスローする。
 * auth.ts は Node.js ランタイム（API Routes / Server Components）専用。
 * middleware（proxy.ts）は auth.config.ts を使うこと。
 */
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Required environment variable "${key}" is not set`)
  return value
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    error(error) {
      console.error("[NextAuth] Error:", error)
    },
    warn(code) {
      console.warn("[NextAuth] Warning:", code)
    },
  },
  providers: [
    {
      id: "cognito",
      name: "Cognito",
      type: "oauth",
      clientId: requireEnv("AUTH_COGNITO_ID"),
      clientSecret: requireEnv("AUTH_COGNITO_SECRET"),
      issuer: requireEnv("AUTH_COGNITO_ISSUER"),
      authorization: {
        url: `${requireEnv("AUTH_COGNITO_DOMAIN")}/oauth2/authorize`,
        params: { scope: "openid profile email", response_type: "code" },
      },
      token: `${requireEnv("AUTH_COGNITO_DOMAIN")}/oauth2/token`,
      userinfo: `${requireEnv("AUTH_COGNITO_DOMAIN")}/oauth2/userInfo`,
      /**
       * jwks_endpoint: type:"oauth" では NextAuth が JWT 署名検証に
       * 使用するかどうかは実装依存。type:"oidc" への移行が安定したら
       * 削除して OIDC discovery に任せることを検討する。
       */
      jwks_endpoint: `${requireEnv("AUTH_COGNITO_ISSUER")}/.well-known/jwks.json`,
      checks: ["pkce", "state"],
      profile(profile) {
        const sub = profile.sub
        const email = profile.email
        if (typeof sub !== "string" || typeof email !== "string") {
          throw new Error("Invalid Cognito profile: missing sub or email")
        }
        return {
          id: sub,
          name: typeof profile.name === "string" ? profile.name : email,
          email,
          image: typeof profile.picture === "string" ? profile.picture : null,
        }
      },
    },
  ],
})
