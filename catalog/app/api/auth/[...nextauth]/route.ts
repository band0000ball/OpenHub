/**
 * NextAuth.js Route Handler
 *
 * GET /api/auth/[...nextauth] と POST /api/auth/[...nextauth] を処理する。
 * Cognito OAuth フロー（コールバック・サインイン・サインアウト等）のエンドポイント。
 */

import { handlers } from "../../../../auth"

export const { GET, POST } = handlers
