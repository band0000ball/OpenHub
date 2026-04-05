<!-- 20260405 結晶化セッションで抽出: patterns/error/source + patterns/error/anti-pattern より統合 -->
---
description: SSR・Edge Runtime環境での制約と正しいパターン（環境変数、ナビゲーション）
---

# SSR・Edge Runtime パターン集

## 1. Edge Runtime の環境変数制約

Lambda@Edge / Edge Runtime では `process.env` が空になる。

**クラッシュ条件（3つが重なると発生）**:
1. Edge Runtime は `process.env` が空（ビルド時インライン展開が前提）
2. fail-fast の requireEnv パターンがモジュール読み込み時に throw
3. `process.env[key]`（ブラケット記法）はバンドラーのインライン展開対象外

**対策**:
- Edge で読み込まれるモジュールから環境変数アクセスを排除する
- 設定ファイルを分離する（例: `auth.config.ts` と `auth.ts`）
- 環境変数は静的ドット記法（`process.env.KEY`）で参照する
- fail-fast チェックは Node.js サーバーでのみ実行する

**適用環境**: Next.js Middleware、Lambda@Edge、Cloudflare Workers

## 2. useRouter ではなく Link を使う

ページ遷移のみが目的の箇所で `useRouter().push()` を使うと、JS ハイドレーション完了前はナビゲーションが動作しない。

**問題**:
- SSR / Edge 環境で JS ハイドレーション失敗時にナビゲーション不能
- Client Component 化によりバンドルサイズ増加

**対策**: ページ遷移のみが目的なら `Link` を使う。
- `Link` は `<a>` タグとしてレンダリングされ JS なしでも動作（Progressive Enhancement）
- Server Component として扱えバンドルサイズ削減
- プリフェッチ自動

**useRouter を使うべき場面**:
- フォーム送信後のリダイレクト
- 遷移前にバリデーション・確認ダイアログが必要
- 動的に遷移先が決まる場合
