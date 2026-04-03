/**
 * 認証ヘルパー — セッションから accessToken を型安全に取得する
 */

import { auth } from "../auth";

/** セッションから accessToken を取得する。未認証の場合は undefined。 */
export async function getAccessToken(): Promise<string | undefined> {
  const session = await auth();
  return (session as { accessToken?: string } | null)?.accessToken;
}
