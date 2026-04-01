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
 *
 * Lambda@Edge 対応:
 *   Lambda@Edge は process.env をサポートしないため、next.config.ts の env フィールドで
 *   ビルド時に値を埋め込む。process.env.X（静的ドット記法）のみ Turbopack がインライン展開
 *   するため、動的アクセス（process.env[key]）は使用しないこと。
 */

import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// 静的アクセス（ドット記法）で参照することで、Turbopack が next.config.ts の env 値を
// ビルド時にリテラルとして埋め込む。動的アクセス（process.env[key]）は展開されないため使わない。
const cognitoId     = process.env.AUTH_COGNITO_ID
const cognitoSecret = process.env.AUTH_COGNITO_SECRET
const cognitoIssuer = process.env.AUTH_COGNITO_ISSUER
const cognitoDomain = process.env.AUTH_COGNITO_DOMAIN

if (!cognitoId || !cognitoSecret || !cognitoIssuer || !cognitoDomain) {
  throw new Error(
    "Missing required Cognito environment variables: " +
    "AUTH_COGNITO_ID, AUTH_COGNITO_SECRET, AUTH_COGNITO_ISSUER, AUTH_COGNITO_DOMAIN"
  )
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
      clientId: cognitoId,
      clientSecret: cognitoSecret,
      issuer: cognitoIssuer,
      authorization: {
        url: `${cognitoDomain}/oauth2/authorize`,
        params: { scope: "openid profile email", response_type: "code" },
      },
      token: `${cognitoDomain}/oauth2/token`,
      userinfo: `${cognitoDomain}/oauth2/userInfo`,
      /**
       * jwks_endpoint: type:"oauth" では NextAuth が JWT 署名検証に
       * 使用するかどうかは実装依存。type:"oidc" への移行が安定したら
       * 削除して OIDC discovery に任せることを検討する。
       */
      jwks_endpoint: `${cognitoIssuer}/.well-known/jwks.json`,
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