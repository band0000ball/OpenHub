# DESIGN — コンポーネント汎用化・Zod 導入（Phase 3.16B）

**Sprint**: Phase 3.16B
**Date**: 2026-04-03
**Status**: 完了（Ship 済み — PR #23）

---

## 背景・課題

全 fetch が `cache: "no-store"` で毎回 Bypass にリクエストが飛ぶ。
行政データ（e-Stat / data.go.jp）は日次〜月次更新のため、数分〜数時間のキャッシュで十分。
e-Stat API キーは認証・レート制限のみで検索結果に影響しないため、認証状態に関わらず同一キャッシュが使える。

---

## 目標・非目標

### 目標

- Next.js の `next.revalidate` を使って ISR キャッシュを導入する
- Bypass API への不要なリクエストを削減する

### 非目標

- Bypass 側の TTL キャッシュ変更（既に 24h キャッシュあり）
- CDN 設定

---

## キャッシュ戦略

| API | 現状 | 変更後 | 理由 |
|-----|------|--------|------|
| `searchDatasets()` | no-store | revalidate: 60 | 検索結果は 1 分キャッシュで十分 |
| `browseByCategory()` | no-store | revalidate: 300 | カテゴリ一覧は 5 分キャッシュ |
| `fetchDataset()` | no-store | revalidate: 300 | 個別データセットは更新頻度低い |
| `getCredentialStatus()` | no-store | no-store (維持) | ユーザー固有の設定状態 |

---

## 成功指標

- [x] searchDatasets / browseByCategory / fetchDataset に revalidate が設定される
- [x] getCredentialStatus は no-store を維持する
- [x] 既存テスト全 pass（24 ファイル・165 テスト）

---

## リスクと前提

### R1: 認証付きリクエストのキャッシュ

e-Stat API キーは検索結果に影響しない（認証・レート制限のみ）ことを確認済み。
認証済み・未認証を問わず同一キャッシュを共有して問題ない。
