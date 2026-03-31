# Changelog

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
