# Changelog

## 2026-04-03

### Added

- **Source Registry 導入（Phase 3.16A）**: `lib/sources.ts` にデータソース定義を集約。
  新ソース追加時に 1 エントリ追加するだけで SourceFilterTabs・SOURCE_LABELS が自動対応。
  `lib/auth-helpers.ts` で accessToken 取得を共通化し、4 箇所の `as` キャストを除去。

- **キャッシュ戦略導入（Phase 3.9）**: Next.js ISR `revalidate` を導入し Bypass API への不要なリクエストを削減。
  検索結果は 60 秒、データセット詳細は 300 秒のキャッシュ。e-Stat API キーは認証・レート制限のみで
  検索結果に影響しないため、認証状態に関わらず同一キャッシュを共有。

### Fixed

- **ログイン後の APIキー取得不能バグ（Phase 3.15）**: `searchDatasets()` / `fetchDataset()` が Bypass API に
  Authorization ヘッダーを送信していなかったため、ログインユーザーが登録した e-Stat API キーが検索時に
  使われなかった問題を修正。RSC ページで `auth()` から accessToken を取得し、全 API 呼び出しに付与。

## 2026-04-02

### Added

- **E2E テスト拡充（Phase 3.7）**: カテゴリタブ・ページネーション・認証フロー・設定ページの 4 フローを
  Playwright E2E テストでカバー。Cognito Hosted UI を使った実際のサインインテストを含む。
  `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` 環境変数で認証情報を注入し、未設定時はスキップされる。

- **Playwright 4 プロジェクト構成**: `setup`（認証セットアップ）・`chromium`（認証不要テスト）・
  `auth-flow`（ログインフロー直接テスト）・`chromium-authenticated`（storageState 再利用テスト）の
  4 プロジェクトに分離。認証テストの分離と storageState 再利用を実現。

### Fixed

- **Bypass テストカバレッジ回復（Phase 3.13）**: `core/credentials.py` の Protocol 互換メソッドと
  `get_credential_store()` ファクトリのテストを追加。credentials.py 76% → 100%、全体 92% → 94%。

- **Vitest テスト環境修正（Phase 3.14）**: `proxy.test.ts` と `api.credentials.test.ts` が
  next-auth v5 beta の ESM モジュール解決エラーで失敗していた問題を修正。
  `vitest.config.ts` に `next/server` エイリアスを追加し、テストのモック対象を正しいモジュールに修正。

- **認証後リダイレクト先の修正**: `proxy.ts` が `/login` へリダイレクトする際に `callbackUrl` を付与し、
  `login/page.tsx` がそれを読み取って `signIn("cognito", { callbackUrl })` に渡すよう修正。
  認証完了後に元のページ（`/settings` 等）に正しく戻るようになった。

### Added

- **e-Stat アプリケーションID 取得案内 UI（Phase 3.6）**: 設定ページに番号付き取得手順（折りたたみ式）を追加。
  e-Stat バナーに「取得方法はこちら」リンクを追加。URL・手順テキストを `lib/estat-guide.ts` で一元管理。

### Fixed

- **フロントエンド品質改善（Phase A）**:
  - `app/error.tsx` を新規作成。RSC クラッシュ時にエラー画面と再試行ボタンを表示するグローバルエラー境界を追加。
  - `app/layout.tsx` の `lang` 属性を `"en"` → `"ja"` に修正。
  - `components/CredentialsForm.tsx` に `aria-required`・`aria-live="polite"`・`aria-describedby` を追加。
  - `components/Pagination.tsx` に `aria-current="page"` を追加。
  - `lib/api.ts` の `DEFAULT_BYPASS_BASE_URL` 定数の重複を解消。
  - `components/SearchResults.tsx` の `console.error` を除去。

- **data.go.jp エンコーディング調査（Phase 3.5）**: e-gov.go.jp API が `application/json;charset=utf-8` を返し、
  現行実装（`response.json()`）が日本語を正しくデコードすることを確認。エンコーディングエッジケーステストを追加。

## 2026-04-01

### Added

- **ページネーション（Bypass API）**: `SearchResponse` に `total`・`has_next`・`limit`・`offset` を追加。
  全ソース横断検索時は各ソースの `total` を合算し、いずれかのソースが失敗した場合は `total=null`・`has_next` フラグで判定する。
- **ページネーション（Catalog UI）**: 検索結果ページにページ送りコントロール（`Pagination` コンポーネント）を追加。
  URL パラメータ `?page=N` でページを指定できる。`total` が不明な場合は `has_next` フラグでボタンの有効/無効を制御する。
- **`Pagination` コンポーネント**: `catalog/components/Pagination.tsx` を新規作成。

## 2026-03-31

### Fixed

- **Cognito 認証フロー**: Amplify 本番環境で認証が完全に動作しなかった複数の原因を修正。
- **未認証リダイレクト**: `proxy.ts` の条件が `!req.auth` だったため NextAuth v5 が返す空オブジェクトに反応せず、`/settings` への未認証アクセスがリダイレクトされない問題を修正。
- **OIDC auto-discovery**: Lambda 環境で失敗していた OIDC discovery を回避するため、Cognito の全エンドポイントを明示指定する `type:"oauth"` プロバイダー設定に変更。
- **UntrustedHost エラー**: Amplify の reverse proxy 配下で発生していた問題を `trustHost: true` で修正。
- **環境変数の欠落**: `AUTH_COGNITO_DOMAIN` が `amplify.yml` に書き出されておらず、NextAuth 初期化時に認可 URL が `undefined/oauth2/authorize` になっていた問題を修正。

### Added

- **環境変数バリデーション**: `auth.ts` 起動時に必須環境変数（`AUTH_COGNITO_DOMAIN` / `AUTH_COGNITO_ISSUER` / `AUTH_COGNITO_ID` / `AUTH_COGNITO_SECRET`）が未設定の場合、即時エラーをスローするフェイルファストを追加。
- **認証ユニットテスト**: `jwt`・`session` コールバックと `profile()` のユニットテストを 14 件追加。
