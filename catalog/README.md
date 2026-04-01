# OpenHub Catalog — Phase 3

日本の行政オープンデータを横断検索できる WebUI。
[OpenHub Bypass](../bypass/) REST API の BFF（フロントエンド）として動作する。

## 概要

- カテゴリタブ付きデータセット一覧（トップページ）
- キーワード検索（全ソース横断・ページネーション対応）
- データセット詳細ページ
- e-Stat アプリケーションID 設定ページ（取得手順案内付き）
- Amazon Cognito 認証（設定ページへのアクセスに必要）

## セットアップ

```bash
cd catalog
npm install
```

`.env.local` に以下を設定:
```
NEXT_PUBLIC_BYPASS_BASE_URL=http://127.0.0.1:8000

# Amazon Cognito（認証が必要な場合）
AUTH_COGNITO_ID=your_cognito_app_client_id
AUTH_COGNITO_SECRET=your_cognito_app_client_secret
AUTH_COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_XXXXXXXX
AUTH_COGNITO_DOMAIN=https://<prefix>.auth.ap-northeast-1.amazoncognito.com
AUTH_SECRET=your_auth_secret_32chars_or_more
AUTH_URL=http://localhost:3000
```

> ローカルで認証なしで動かす場合は `BYPASS_BASE_URL` のみ設定し、Bypass 側で `DISABLE_AUTH=true` を指定する。

## 起動

事前に OpenHub Bypass を起動しておく:
```bash
# bypass/ で
python main.py
```

Catalog を起動:
```bash
# catalog/ で
npm run dev
```

http://localhost:3000 でアクセス。

## 主要ページ

| URL | 説明 | 認証 |
|-----|------|------|
| `/` | トップ：カテゴリタブ＋データセット一覧 | 不要 |
| `/?category=population` | カテゴリ絞り込み（人口・世帯） | 不要 |
| `/search?q=<keyword>` | キーワード検索結果（`&page=N` でページ指定） | 不要 |
| `/datasets/<id>` | データセット詳細 | 不要 |
| `/settings` | e-Stat アプリケーションID 設定 | **必須**（`proxy.ts` でガード） |
| `/login` | Cognito サインイン（自動リダイレクト） | — |

## カテゴリ一覧

| id | ラベル | キーワード |
|----|--------|-----------|
| `all` | 全て | （並列フェッチ） |
| `population` | 人口・世帯 | 人口 |
| `economy` | 経済・産業 | 経済 |
| `environment` | 環境・気象 | 環境 |
| `education` | 教育・文化 | 教育 |
| `healthcare` | 医療・福祉 | 医療 |

## テスト

```bash
npm test              # Vitest（ユニット）
npm run test:e2e      # Playwright（E2E）
```

## 技術スタック

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- NextAuth.js v5 + Amazon Cognito（JWT 認証）
- Vitest + React Testing Library（ユニット）
- Playwright（E2E）

## 認証アーキテクチャ（Sprint 3.1）

| ファイル | 役割 |
|---------|------|
| `auth.ts` | NextAuth.js v5 設定（Cognito プロバイダー・JWT セッション・accessToken コールバック） |
| `proxy.ts` | 認証ガード（`/settings` → 未認証時 `/login` にリダイレクト） |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth Route Handler |
| `app/login/page.tsx` | Cognito サインインページ（マウント時 `signIn("cognito")` を呼び出す） |
| `types/next-auth.d.ts` | `Session.accessToken` 型拡張 |

> **Note**: Next.js 16 では `middleware.ts` が deprecated。認証ガードは `proxy.ts` に記述する。
