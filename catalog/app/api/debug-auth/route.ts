/**
 * 一時診断エンドポイント — 確認後に削除すること
 */
import { existsSync, readFileSync } from "fs"
import { join } from "path"

function mask(val: string | undefined): string {
  if (!val) return "❌ 未設定"
  if (val.length < 4) return "⚠️ 短すぎる"
  return `✅ (${val.length}文字, 末尾: ...${val.slice(-4)})`
}

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  // auth初期化テスト
  let authInitError = "ok"
  try {
    const { handlers } = await import("../../../auth")
    if (!handlers) authInitError = "handlers is null"
  } catch (e: unknown) {
    authInitError = e instanceof Error ? e.message : String(e)
  }

  const cwd = process.cwd()
  const envFile = join(cwd, ".env.production.local")
  const envFileExists = existsSync(envFile)
  let envKeys: string[] = []
  if (envFileExists) {
    envKeys = readFileSync(envFile, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("=")[0])
  }

  return Response.json({
    authInitError,
    envFileExists,
    envKeys,
    AUTH_SECRET: mask(process.env.AUTH_SECRET),
    AUTH_COGNITO_ID: mask(process.env.AUTH_COGNITO_ID),
    AUTH_COGNITO_ISSUER: mask(process.env.AUTH_COGNITO_ISSUER),
    AUTH_COGNITO_DOMAIN: mask(process.env.AUTH_COGNITO_DOMAIN),
    NODE_ENV: process.env.NODE_ENV,
  })
}
