/**
 * 一時診断エンドポイント — デプロイ後に削除すること
 * AUTH_ 環境変数の存在確認（値は隠す）
 */
export async function GET(): Promise<Response> {
  const check = (key: string) => {
    const val = process.env[key]
    if (!val) return "❌ 未設定"
    if (val.length < 4) return "⚠️ 短すぎる"
    return `✅ 設定済み (${val.length}文字, 末尾: ...${val.slice(-4)})`
  }

  return Response.json({
    AUTH_SECRET: check("AUTH_SECRET"),
    AUTH_URL: check("AUTH_URL"),
    AUTH_COGNITO_ID: check("AUTH_COGNITO_ID"),
    AUTH_COGNITO_SECRET: check("AUTH_COGNITO_SECRET"),
    AUTH_COGNITO_ISSUER: check("AUTH_COGNITO_ISSUER"),
    NEXT_PUBLIC_BYPASS_BASE_URL: check("NEXT_PUBLIC_BYPASS_BASE_URL"),
    NODE_ENV: process.env.NODE_ENV,
  })
}
