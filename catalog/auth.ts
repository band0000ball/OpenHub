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

const cognitoDomain = process.env.AUTH_COGNITO_DOMAIN
const cognitoIssuer = process.env.AUTH_COGNITO_ISSUER

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "cognito",
      name: "Cognito",
      type: "oauth",
      clientId: process.env.AUTH_COGNITO_ID,
      clientSecret: process.env.AUTH_COGNITO_SECRET ?? "",
      issuer: cognitoIssuer,
      authorization: {
        url: `${cognitoDomain}/oauth2/authorize`,
        params: { scope: "openid profile email", response_type: "code" },
      },
      token: `${cognitoDomain}/oauth2/token`,
      userinfo: `${cognitoDomain}/oauth2/userInfo`,
      jwks_endpoint: `${cognitoIssuer}/.well-known/jwks.json`,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub as string,
          name: (profile.name ?? profile.email) as string,
          email: profile.email as string,
          image: (profile.picture ?? null) as string | null,
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
