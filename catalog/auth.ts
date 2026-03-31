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

/**
 * 必須環境変数を取得する。未設定の場合は起動時にエラーをスローする。
 */
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Required environment variable "${key}" is not set`)
  return value
}

const cognitoDomain = requireEnv("AUTH_COGNITO_DOMAIN")
const cognitoIssuer = requireEnv("AUTH_COGNITO_ISSUER")

export const { handlers, auth, signIn, signOut } = NextAuth({
  /**
   * trustHost: Amplify は X-Forwarded-Host を設定するため、
   * reverse proxy 配下では必須。ローカル開発では AUTH_URL を
   * 明示設定することで代替可能。
   */
  trustHost: true,
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
  pages: {
    signIn: "/login",
  },
})
