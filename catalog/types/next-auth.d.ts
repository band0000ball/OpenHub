/**
 * NextAuth.js 型拡張
 *
 * Session に accessToken を追加する。
 * Bypass の保護エンドポイントに Bearer トークンを渡すために使用する。
 */

import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    /** Cognito Access Token（Bypass の Bearer トークンとして使用）*/
    accessToken?: string
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string
  }
}
