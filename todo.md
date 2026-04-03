# TODO — AWS 環境改善

## 優先度: 高

- [x] **D3: proxy.ts の Amplify 動作確認** — 正常動作を確認。auth-flow テスト失敗は Cognito セッション自動ログインが原因（proxy.ts の問題ではない）
- [ ] **E4: auth-flow テストの AWS スキップ** — setup で Cognito ログイン済みのため auth-flow は自動ログインされ Cognito UI を経由しない。AWS ではスキップし、setup + chromium-authenticated で認証を検証
- [ ] **E5: タブクリックテストの flaky 対策** — AWS 環境でナビゲーション遅延によりタブ切替テストが不安定。waitForURL のタイムアウト延長または waitForNavigation 追加
- [ ] **E2: E2E ウォームアップリクエスト** — テスト実行前にトップページを叩いて Amplify/Lambda の Cold Start を解消
- [ ] **E6: auth setup 前に .auth/state.json を削除** — 古いローカルセッションが残ると AWS テストが不正に pass する

## 優先度: 中

- [ ] **A4: EventBridge Ping** — 5 分ごとに Lambda を呼んで warm 状態を維持
- [ ] **A5: ARM64 (Graviton2) 移行** — template.yaml に `Architectures: [arm64]` 追加。起動速度向上 + コスト 20% 減
- [ ] **D1: Cognito リダイレクトチェーン最小化** — /settings → /login → Cognito の 4 ホップを削減

## 優先度: 低

- [ ] **A1: Provisioned Concurrency** — Lambda の常時 warm 維持（コスト増）
- [ ] **A3: Lambda 関数サイズ削減** — 不要依存の除外
- [ ] **B1: Amplify バンドルサイズ削減** — serverExternalPackages で不要モジュール除外
- [ ] **B3: Amplify Compute 設定調整** — メモリ/タイムアウト見直し
