# TODO — AWS 環境改善

## 優先度: 高

- [x] **D3: proxy.ts の Amplify 動作確認** — 正常動作を確認。auth-flow テスト失敗は Cognito セッション自動ログインが原因（proxy.ts の問題ではない）
- [x] **E4: auth-flow テストの AWS スキップ** — PR #27 で対応
- [x] **E5: タブクリックテストの flaky 対策** — PR #27 でタイムアウト 15s に延長
- [x] **E2: E2E ウォームアップ** — PR #27 で auth.setup.ts に Promise.race パターン導入
- [x] **E6: auth setup 前に state.json 削除** — PR #27 で対応
- [x] **E7: /login サーバーサイドリダイレクト化** — PR #27 でクライアント JS 不要に

## 優先度: 高（新規）

- [ ] **S1: Bypass 経由の e-Stat 検索で API キーが取得できていない** — Catalog 経由で DynamoDB に登録済みの API キーが、`/datasets/search?source=estat` で使われていない可能性。Collector は `ESTAT_API_KEY` 環境変数で動作するが、ユーザーリクエスト経由の検索で認証エラー（0件）になる。CredentialStore → Bypass 検索の連携を調査する。
- [ ] **S2: e-Stat の Collector 全件取得** — 現在 14,000 件だが e-Stat には約 30 万件の統計表がある。空クエリ `searchWord=` の挙動調査 + 主要カテゴリ別キーワード検索型の収集戦略を検討する。S1 の API キー問題と合わせて対応。

## 優先度: 中

- [ ] **A4: EventBridge Ping** — 5 分ごとに Lambda を呼んで warm 状態を維持
- [x] **A5: ARM64 (Graviton2) 移行** — template.yaml に Architectures: [arm64] 追加。自動デプロイで反映済み
- [x] **D1: Cognito リダイレクトチェーン最小化** — PR #27 で /login サーバーサイド化により実質解決（残り ~50ms の改善は PKCE 手動実装が必要でリスク過大）

## 優先度: 低

- [ ] **A1: Provisioned Concurrency** — Lambda の常時 warm 維持（コスト増）
- [ ] **A3: Lambda 関数サイズ削減** — 不要依存の除外
- [ ] **B1: Amplify バンドルサイズ削減** — serverExternalPackages で不要モジュール除外
- [ ] **B3: Amplify Compute 設定調整** — メモリ/タイムアウト見直し
