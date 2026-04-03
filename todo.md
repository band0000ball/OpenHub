# TODO — AWS 環境改善

## 優先度: 高

- [ ] **D3: proxy.ts の Amplify 動作確認** — E2E テストで /settings が認証なしで表示される。proxy.ts の認証ガードが Amplify SSR で機能していない可能性を調査・修正
- [ ] **E2: E2E ウォームアップリクエスト** — テスト実行前にトップページを叩いて Amplify/Lambda の Cold Start を解消

## 優先度: 中

- [ ] **A4: EventBridge Ping** — 5 分ごとに Lambda を呼んで warm 状態を維持
- [ ] **A5: ARM64 (Graviton2) 移行** — template.yaml に `Architectures: [arm64]` 追加。起動速度向上 + コスト 20% 減
- [ ] **D1: Cognito リダイレクトチェーン最小化** — /settings → /login → Cognito の 4 ホップを削減
- [ ] **E1: AWS 向けタイムアウト延長** — auth テストのタイムアウトを 60〜120s に
- [ ] **E3: auth setup リトライ強化** — 2 retries → 3 retries

## 優先度: 低

- [ ] **A1: Provisioned Concurrency** — Lambda の常時 warm 維持（コスト増）
- [ ] **A3: Lambda 関数サイズ削減** — 不要依存の除外
- [ ] **B1: Amplify バンドルサイズ削減** — serverExternalPackages で不要モジュール除外
- [ ] **B3: Amplify Compute 設定調整** — メモリ/タイムアウト見直し
