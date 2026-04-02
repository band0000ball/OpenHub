# DESIGN — E2E テスト拡充（Phase 3.7）

**Sprint**: Phase 3.7
**Date**: 2026-04-02
**Status**: 完了（Ship 済み — PR #17）

---

## 背景・課題

Phase 3.4（ページネーション）・Phase 3.6（e-Stat 取得案内 UI）で新機能を追加したが、
これらのフローをカバーする E2E テストが存在しない。
重要なユーザーフローがリグレッションで壊れても CI で検知できない状態にある。

---

## 目標・非目標

### 目標

- ページネーション・認証（ログイン完了まで）・設定フロー・カテゴリタブの 4 フローを E2E テストで自動検証する
- 認証テストは `storageState` でセッションを保存し、他テストで再利用できるようにする
- CI（GitHub Actions 等）で既存の E2E テストと同じ方法で実行できる

### 非目標

- Cognito テストユーザーの自動作成・削除
- APIキーの実際の保存フロー（Bypass 起動が前提のため今回はスコープ外）
- Amplify 本番環境での E2E 実行

---

## 制約条件

- Cognito の OAuth リダイレクトは外部ページのため、Playwright がタイムアウトするリスクがある
  → 認証テストには長めのタイムアウト（30秒）を設定し、`storageState` で再利用する
- テスト用の Cognito 認証情報は環境変数（`E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`）で注入する
  → 認証情報未設定時はテストをスキップする（`test.skip`）

---

## 追加するテストシナリオ

| シナリオ | ファイル | 概要 |
|---------|---------|------|
| カテゴリタブ | `e2e/catalog.spec.ts`（既存に追加） | タブクリック → URL `/?category=population` |
| ページネーション | `e2e/catalog.spec.ts`（既存に追加） | 「次のページ」クリック → `?page=2` + 結果表示 |
| 設定フロー | `e2e/settings.spec.ts`（新規） | 取得手順セクション表示・未認証リダイレクト |
| 認証 | `e2e/auth.spec.ts`（新規） | `/login` → Cognito サインイン → `/settings` 到達 |

---

## 成功指標

- [x] 4シナリオ（カテゴリタブ・ページネーション・設定フロー・認証）が E2E テストでカバーされる
- [x] 認証テストは `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` が未設定の場合スキップされる
- [x] `storageState` によるセッション再利用が機能する
- [x] 既存の E2E テスト（15件に拡充）が引き続き通過する

---

## リスクと前提

### R1: Cognito 外部リダイレクトのタイムアウト（最重要）

Playwright が Cognito ホスト UI（`auth.ap-northeast-1.amazoncognito.com`）への
リダイレクトを待ちきれずタイムアウトする可能性がある。

**対策**:
- `page.waitForURL` のタイムアウトを 30 秒に設定
- `storageState` でログイン済み状態を保存し、認証テスト以外では再利用する
- フレーキーなテストは `test.fixme` でマークし、CI ブロッカーにしない

### R2: テスト用認証情報の管理

**対策**: `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` 環境変数で注入。`.env.test` に記載し `.gitignore` 済みとする。

---

## 実装メモ（DESIGN.md リバースシンク）

### 仕様外の追加実装

- **callbackUrl パススルー**: `proxy.ts` → `/login?callbackUrl=...` → `signIn("cognito", { callbackUrl })` の連携を追加。
  DESIGN.md には未記載だったが、認証後のリダイレクト先を正しく制御するために必要だった。
- **FORCE_CHANGE_PASSWORD ハンドリング**: Cognito の初回ログイン時パスワード変更チャレンジに対応。
  テストユーザーが `FORCE_CHANGE_PASSWORD` 状態で作成される場合に必要。
- **Playwright 4 プロジェクト構成**: `setup` / `chromium` / `auth-flow` / `chromium-authenticated` に分離。
  `auth-flow` は storageState なしで直接ログインフローをテストする専用プロジェクト。
