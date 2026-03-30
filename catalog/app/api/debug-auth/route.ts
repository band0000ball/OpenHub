/**
 * 一時診断エンドポイント — 確認後に削除すること
 */
import { existsSync, readFileSync } from "fs"
import { join } from "path"

function mask(val: string | undefined): string {
  if (!val) return "❌ 未設定"
  if (val.length < 4) return "⚠️ 短すぎる"
  return `✅ 設定済み (${val.length}文字, 末尾: ...${val.slice(-4)})`
}

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const cwd = process.cwd()
  const envFilePath = join(cwd, ".env.production.local")
  const envFileExists = existsSync(envFilePath)
  let envFilePreview = "（ファイルなし）"
  if (envFileExists) {
    const raw = readFileSync(envFilePath, "utf-8")
    // 値を隠してキー名と長さだけ表示
    envFilePreview = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [k, ...rest] = line.split("=")
        const v = rest.join("=")
        return v ? `${k}=***（${v.length}文字）` : `${k}=（空）`
      })
      .join(", ")
  }

  return Response.json({
    cwd,
    envFile: envFilePath,
    envFileExists,
    envFilePreview,
    AUTH_SECRET: mask(process.env.AUTH_SECRET),
    AUTH_URL: mask(process.env.AUTH_URL),
    AUTH_COGNITO_ID: mask(process.env.AUTH_COGNITO_ID),
    AUTH_COGNITO_SECRET: mask(process.env.AUTH_COGNITO_SECRET),
    AUTH_COGNITO_ISSUER: mask(process.env.AUTH_COGNITO_ISSUER),
    NEXT_PUBLIC_BYPASS_BASE_URL: mask(process.env.NEXT_PUBLIC_BYPASS_BASE_URL),
    NODE_ENV: process.env.NODE_ENV,
  })
}
