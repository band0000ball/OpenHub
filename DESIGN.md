# DESIGN — Bypass テストカバレッジ回復（Phase 3.13）

**Sprint**: Phase 3.13
**Date**: 2026-04-02
**Status**: 完了（Ship 済み — PR #19）

---

## 背景・課題

Bypass の全体カバレッジは 92% だが、`core/credentials.py` が 76% で 80% 閾値を下回っている。
Protocol 互換の 2 引数 API（get/save/is_configured）と DynamoDB バックエンド選択パスが未テスト。

---

## 目標・非目標

### 目標

- `core/credentials.py` のカバレッジを 80%+ にする
- `python -m pytest` が全 pass（`--cov-fail-under=80` 含む）
- 全体カバレッジ 92%+ を維持

### 非目標

- 実装コードの変更・新機能追加
- 他モジュールの大規模テスト追加（余力があればエッジケースのみ）

---

## テスト追加対象

### core/credentials.py（76% → 80%+）— 必須

未カバー行（9 statements）:
- Lines 97-103: `get(user_id, source_id)` 2 引数パス
- Line 128: `save()` メソッド（Protocol 互換ラッパー）
- Line 143: `is_configured()` メソッド（Protocol 互換ラッパー）
- Lines 173-174: DynamoDB バックエンド初期化パス（`get_credential_store()`）

---

## 成功指標

- [x] `core/credentials.py` が 80%+ になる（100% 達成）
- [x] `python -m pytest` が全 pass（162 passed）
- [x] 全体カバレッジ 92%+ を維持（94% 達成）

---

## リスクと前提

### R1: DynamoDB バックエンド選択テスト

`get_credential_store()` の DynamoDB パスは AWS SDK に依存する。
→ 環境変数モック + モジュールのモックで回避
