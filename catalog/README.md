# OpenHub Catalog — Phase 2

日本の行政オープンデータを横断検索できる WebUI。
[OpenHub Bypass](../bypass/) REST API の BFF（フロントエンド）として動作する。

## 概要

- カテゴリタブ付きデータセット一覧（トップページ）
- キーワード検索（全ソース横断）
- データセット詳細ページ
- e-Stat アプリケーションID 設定ページ（Catalog から Bypass に登録）

## セットアップ

```bash
cd catalog
npm install
```

`.env.local` に Bypass の URL を設定:
```
BYPASS_BASE_URL=http://127.0.0.1:8000
```

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

| URL | 説明 |
|-----|------|
| `/` | トップ：カテゴリタブ＋データセット一覧 |
| `/?category=population` | カテゴリ絞り込み（人口・世帯） |
| `/search?q=<keyword>` | キーワード検索結果 |
| `/datasets/<id>` | データセット詳細 |
| `/settings` | e-Stat アプリケーションID 設定 |

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

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Vitest + React Testing Library（ユニット）
- Playwright（E2E）
