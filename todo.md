# TODO — AWS 環境改善

## 優先度: 高

- [x] **D3: proxy.ts の Amplify 動作確認** — 正常動作を確認。auth-flow テスト失敗は Cognito セッション自動ログインが原因（proxy.ts の問題ではない）
- [x] **E4: auth-flow テストの AWS スキップ** — PR #27 で対応
- [x] **E5: タブクリックテストの flaky 対策** — PR #27 でタイムアウト 15s に延長
- [x] **E2: E2E ウォームアップ** — PR #27 で auth.setup.ts に Promise.race パターン導入
- [x] **E6: auth setup 前に state.json 削除** — PR #27 で対応
- [x] **E7: /login サーバーサイドリダイレクト化** — PR #27 でクライアント JS 不要に

## 優先度: 高（新規）

- [x] **S1: Bypass 経由の e-Stat 検索で API キーが取得できていない** — ~~バグではなかった~~。検索は S3 キャッシュ経由に移行済みのため API キー不要。データ取得（詳細ページ）は DynamoDB 経由で正常動作（要ログイン）。Collector は環境変数で動作。
- [x] **S2: e-Stat の Collector 全件取得** — 空クエリ `searchWord=` で取得可能な全件は約 43,000 件（重複除去済み）。上限 500,000 + 重複除去を実装済み。e-Stat API の空クエリがこれ以上返さないため、これが実質的な全件。30万件という見積もりは統計表＋データの合計であり、getStatsList で返るメタデータは約 43,000 件が上限。

## 優先度: 中

- [ ] **A4: EventBridge Ping** — 5 分ごとに Lambda を呼んで warm 状態を維持
- [x] **A5: ARM64 (Graviton2) 移行** — template.yaml に Architectures: [arm64] 追加。自動デプロイで反映済み
- [x] **D1: Cognito リダイレクトチェーン最小化** — PR #27 で /login サーバーサイド化により実質解決（残り ~50ms の改善は PKCE 手動実装が必要でリスク過大）

## 優先度: 低

- [ ] **A1: Provisioned Concurrency** — Lambda の常時 warm 維持（コスト増）
- [ ] **A3: Lambda 関数サイズ削減** — 不要依存の除外
- [ ] **B1: Amplify バンドルサイズ削減** — serverExternalPackages で不要モジュール除外
- [ ] **B3: Amplify Compute 設定調整** — メモリ/タイムアウト見直し
