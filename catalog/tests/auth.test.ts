/**
 * auth.ts のユニットテスト
 *
 * NextAuth の初期化（外部通信を伴う）はモックし、
 * コールバックロジック（jwt / session）と profile() を直接検証する。
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---- NextAuth のモック ----
// NextAuth(config) を呼ぶとコールバックを設定するだけで外部通信は起きない。
// ただし next-auth 内部で process.env を参照するため、モックで差し替える。

type JwtCallbackArgs = {
  token: Record<string, unknown>
  account: { access_token?: string } | null
}

type SessionCallbackArgs = {
  session: Record<string, unknown>
  token: Record<string, unknown>
}

type CognitoProfile = {
  sub?: unknown
  email?: unknown
  name?: unknown
  picture?: unknown
}

type NextAuthConfig = {
  callbacks?: {
    jwt?: (args: JwtCallbackArgs) => Record<string, unknown>
    session?: (args: SessionCallbackArgs) => Record<string, unknown>
  }
  providers?: Array<{
    profile?: (profile: CognitoProfile) => Record<string, unknown>
  }>
}

let capturedConfig: NextAuthConfig = {}

vi.mock("next-auth", () => ({
  default: (config: NextAuthConfig) => {
    capturedConfig = config
    return {
      handlers: { GET: vi.fn(), POST: vi.fn() },
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    }
  },
}))

describe("auth — requireEnv", () => {
  it("AUTH_COGNITO_DOMAIN が未設定のとき import でエラーをスローする", async () => {
    const original = {
      AUTH_COGNITO_DOMAIN: process.env.AUTH_COGNITO_DOMAIN,
      AUTH_COGNITO_ISSUER: process.env.AUTH_COGNITO_ISSUER,
      AUTH_COGNITO_ID: process.env.AUTH_COGNITO_ID,
    }
    delete process.env.AUTH_COGNITO_DOMAIN
    process.env.AUTH_COGNITO_ISSUER = "https://example.com/pool"
    process.env.AUTH_COGNITO_ID = "client-id"

    // モジュールキャッシュをクリアして再 import する
    vi.resetModules()
    await expect(import("../auth")).rejects.toThrow(
      'Required environment variable "AUTH_COGNITO_DOMAIN" is not set'
    )

    // 環境変数を元に戻す
    Object.assign(process.env, original)
    vi.resetModules()
  })
})

describe("auth — jwt コールバック", () => {
  beforeEach(async () => {
    process.env.AUTH_COGNITO_DOMAIN = "https://example.auth.ap-northeast-1.amazoncognito.com"
    process.env.AUTH_COGNITO_ISSUER = "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_test"
    process.env.AUTH_COGNITO_ID = "test-client-id"
    vi.resetModules()
    await import("../auth")
  })

  it("account.access_token があるとき token に accessToken を追加する", () => {
    const jwt = capturedConfig.callbacks?.jwt
    expect(jwt).toBeDefined()

    const result = jwt!({
      token: { sub: "user-123" },
      account: { access_token: "eyJhbGciOiJSUzI1NiJ9.test" },
    })

    expect(result).toEqual({
      sub: "user-123",
      accessToken: "eyJhbGciOiJSUzI1NiJ9.test",
    })
  })

  it("account が null のとき token をそのまま返す", () => {
    const jwt = capturedConfig.callbacks?.jwt
    expect(jwt).toBeDefined()

    const token = { sub: "user-123", accessToken: "existing-token" }
    const result = jwt!({ token, account: null })

    expect(result).toEqual(token)
  })

  it("account.access_token がないとき token をそのまま返す", () => {
    const jwt = capturedConfig.callbacks?.jwt
    expect(jwt).toBeDefined()

    const token = { sub: "user-123" }
    const result = jwt!({ token, account: {} })

    expect(result).toEqual(token)
  })
})

describe("auth — session コールバック", () => {
  beforeEach(async () => {
    process.env.AUTH_COGNITO_DOMAIN = "https://example.auth.ap-northeast-1.amazoncognito.com"
    process.env.AUTH_COGNITO_ISSUER = "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_test"
    process.env.AUTH_COGNITO_ID = "test-client-id"
    vi.resetModules()
    await import("../auth")
  })

  it("token に accessToken があるとき session に accessToken を含める", () => {
    const sessionCb = capturedConfig.callbacks?.session
    expect(sessionCb).toBeDefined()

    const result = sessionCb!({
      session: { user: { name: "test" }, expires: "2099-01-01" },
      token: { sub: "user-123", accessToken: "bearer-token" },
    })

    expect(result).toMatchObject({
      user: { name: "test" },
      expires: "2099-01-01",
      accessToken: "bearer-token",
    })
  })

  it("token に accessToken がないとき session.accessToken は undefined", () => {
    const sessionCb = capturedConfig.callbacks?.session
    expect(sessionCb).toBeDefined()

    const result = sessionCb!({
      session: { user: { name: "test" }, expires: "2099-01-01" },
      token: { sub: "user-123" },
    })

    expect(result.accessToken).toBeUndefined()
  })
})

describe("auth — profile()", () => {
  beforeEach(async () => {
    process.env.AUTH_COGNITO_DOMAIN = "https://example.auth.ap-northeast-1.amazoncognito.com"
    process.env.AUTH_COGNITO_ISSUER = "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_test"
    process.env.AUTH_COGNITO_ID = "test-client-id"
    vi.resetModules()
    await import("../auth")
  })

  it("sub と email があるとき正しいユーザーオブジェクトを返す", () => {
    const profile = capturedConfig.providers?.[0]?.profile
    expect(profile).toBeDefined()

    const result = profile!({
      sub: "cognito-user-sub",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    })

    expect(result).toEqual({
      id: "cognito-user-sub",
      name: "Test User",
      email: "test@example.com",
      image: "https://example.com/avatar.jpg",
    })
  })

  it("name がないとき email を name として使用する", () => {
    const profile = capturedConfig.providers?.[0]?.profile
    expect(profile).toBeDefined()

    const result = profile!({
      sub: "cognito-user-sub",
      email: "test@example.com",
    })

    expect(result.name).toBe("test@example.com")
  })

  it("picture がないとき image は null", () => {
    const profile = capturedConfig.providers?.[0]?.profile
    expect(profile).toBeDefined()

    const result = profile!({
      sub: "cognito-user-sub",
      email: "test@example.com",
    })

    expect(result.image).toBeNull()
  })

  it("sub が文字列でないとき Error をスローする", () => {
    const profile = capturedConfig.providers?.[0]?.profile
    expect(profile).toBeDefined()

    expect(() =>
      profile!({ sub: undefined, email: "test@example.com" })
    ).toThrow("Invalid Cognito profile: missing sub or email")
  })

  it("email が文字列でないとき Error をスローする", () => {
    const profile = capturedConfig.providers?.[0]?.profile
    expect(profile).toBeDefined()

    expect(() =>
      profile!({ sub: "cognito-user-sub", email: undefined })
    ).toThrow("Invalid Cognito profile: missing sub or email")
  })
})
