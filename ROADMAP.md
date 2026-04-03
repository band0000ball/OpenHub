# OpenHub ロードマップ

日本の行政オープンデータを横断検索・取得するプラットフォーム。

## 凡例

| 記号 | 意味 |
|------|------|
| ✅ | 完了（リリース済み） |
| 🚧 | 対応中 |
| 📋 | 計画済み |
| 💡 | アイデア（未確定） |

---

## ✅ Phase 1 — REST API（Bypass）

**目標**: e-Stat と data.go.jp を横断検索できる REST API ゲートウェイ

| # | 機能 | 状態 |
|---|------|------|
| 1.1 | e-Stat コネクター（検索・取得） | ✅ |
| 1.2 | data.go.jp コネクター（検索・取得） | ✅ |
| 1.3 | BYOK モデル（インメモリ APIキー管理） | ✅ |
| 1.4 | TTL キャッシュ（24時間） | ✅ |
| 1.5 | 統一エラーハンドリング（3層変換） | ✅ |
| 1.6 | テスト（pytest + respx）93%+ カバレッジ | ✅ |

---

## ✅ Phase 2 — Catalog WebUI

**目標**: Bypass を BFF とする Next.js 製のデータカタログ UI

| # | 機能 | 状態 |
|---|------|------|
| 2.1 | カテゴリタブ付きデータセット一覧（トップページ） | ✅ |
| 2.2 | キーワード検索ページ | ✅ |
| 2.3 | データセット詳細ページ | ✅ |
| 2.4 | 設定ページ（e-Stat アプリケーションID 登録） | ✅ |
| 2.5 | e-Stat 未設定時の案内バナー | ✅ |
| 2.x | data.go.jp エンドポイント移転対応（e-gov.go.jp） | ✅ |
| 2.x | 504 タイムアウト修正（上流エラー時スキップ） | ✅ |
| 2.x | キャッシュポイズニング修正（APIキー登録後クリア） | ✅ |
| 2.x | テスト（Vitest + RTL）98%+ カバレッジ | ✅ |

---

## ✅ Phase 3 — 認証・安定化・UX 改善

**目標**: Amazon Cognito 認証基盤を確立し、日常利用に耐える品質と UX を整える

| # | 機能 | 優先度 | 状態 | 備考 |
|---|------|--------|------|------|
| 3.1 | Cognito JWT 認証基盤 | 高 | ✅ | Bypass JWT 検証 + Catalog NextAuth.js v5 |
| 3.2 | DynamoDB CredentialStore（APIキー永続化・ユーザー分離） | 高 | ✅ | CREDENTIAL_STORE_BACKEND で切り替え |
| 3.3 | Lambda + Amplify デプロイ（Mangum adapter） | 高 | ✅ | Bypass → Lambda Function URL、Catalog → Amplify |
| 3.4 | ページネーション（検索結果・一覧） | 中 | ✅ | Bypass `total`/`has_next` 実装 + Catalog UI |
| 3.5 | data.go.jp 文字化け調査・修正 | 中 | ✅ | e-gov.go.jp レスポンスの文字コード（再現不可・実装正常を確認） |
| 3.6 | e-Stat アプリケーションID 取得案内 | 低 | ✅ | 外部リンク + 取得手順の UI |
| 3.7 | E2E テスト拡充（Playwright） | 中 | ✅ | ページネーション・認証・設定フローを追加カバー |
| 3.8 | DatasetBrowser エラー時リトライ | 中 | ✅ | ErrorRetry コンポーネントで router.refresh() 再試行、サーチバー・タブ維持 |
| 3.9 | キャッシュ戦略導入 | 中 | ✅ | ISR revalidate 導入（search: 60s, dataset: 300s, credentialStatus: no-store 維持） |
| 3.16A | Source Registry 導入・型安全化 | 中 | ✅ | `lib/sources.ts` + `lib/auth-helpers.ts` 新規作成、SourceFilterTabs 動的生成、as キャスト除去 |
| 3.16B | コンポーネント汎用化・Zod 導入 | 中 | ✅ | DatasetListView 抽出、CredentialsBanner 汎用化、CredentialsForm ソース汎用化、Zod バリデーション |
| 3.13 | Bypass テストカバレッジ回復（80%+） | 中 | ✅ | credentials.py 76%→100%、全体 92%→94% |
| 3.14 | Catalog テスト環境修正（next-auth × Vitest） | 中 | ✅ | `next/server` エイリアス追加 + モック修正で全テスト pass |
| 3.15 | ログイン後の APIキー取得不能バグ修正 | **高** | ✅ | Catalog 側で accessToken を Bypass に送信するよう修正（根因: Authorization ヘッダー欠落） |

---

## 📋 Phase 4 — データソース拡張

**目標**: 対応データソースを拡大する

| # | データソース | 優先度 | 備考 |
|---|-------------|--------|------|
| 4.1 | e-Gov 法令 API | 中 | ✅ | EGovLawConnector 追加。認証不要、キーワード検索 + 全文取得 |
| 4.2 | e-Gov パブリックコメント | 低 | 意見公募情報 |
| 4.3 | ~~国土数値情報~~ | — | 旧 API 廃止（2020）。バルクダウンロード型のため OpenHub Archive で対応予定 |
| 4.4 | 不動産情報ライブラリ API | 中 | 国土数値情報の一部を REST API で提供。タイル座標ベース（API キー申請必要） |

---

## 💡 Phase 5 — 高度化（未確定）

| # | 機能 | 備考 |
|---|------|------|
| 5.1 | RESAS（地域経済分析システム） | APIキー必要 |
| 5.2 | 気象データ（JMA） | 公開 API |
| 5.3 | 複数ワーカー対応（Redis 等への CredentialStore 移行） | スケールアウト要件 |
| 5.4 | データプレビュー（CSV・GeoJSON の可視化） | 地図・グラフ表示 |

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Bypass (API) | Python 3.12 / FastAPI / httpx / pytest |
| Catalog (UI) | Next.js 16 App Router / TypeScript / Tailwind CSS |
| テスト (UI) | Vitest / React Testing Library / Playwright |
| インフラ | AWS Lambda（Bypass）/ AWS Amplify（Catalog）/ Amazon Cognito / DynamoDB |

---

*最終更新: 2026-04-02（Phase 3.5 完了・3.13〜3.14 追加）*
