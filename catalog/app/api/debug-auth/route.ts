/**
 * 一時診断エンドポイント — 確認後に削除すること
 * 静的アクセスで環境変数の存在確認（値の末尾4文字のみ表示）
 */
function mask(val: string | undefined): string {
  if (!val) return "❌ 未設定"
  if (val.length < 4) return "⚠️ 短すぎる"
  return `✅ 設定済み (${val.length}文字, 末尾: ...${val.slice(-4)})`
}

export async function GET(): Promise<Response> {
  return Response.json({
    AUTH_SECRET: mask(process.env.AUTH_SECRET),
    AUTH_URL: mask(process.env.AUTH_URL),
    AUTH_COGNITO_ID: mask(process.env.AUTH_COGNITO_ID),
    AUTH_COGNITO_SECRET: mask(process.env.AUTH_COGNITO_SECRET),
    AUTH_COGNITO_ISSUER: mask(process.env.AUTH_COGNITO_ISSUER),
    NEXT_PUBLIC_BYPASS_BASE_URL: mask(process.env.NEXT_PUBLIC_BYPASS_BASE_URL),
    NODE_ENV: process.env.NODE_ENV,
  })
}
