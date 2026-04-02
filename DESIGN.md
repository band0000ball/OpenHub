# DESIGN — APIキー取得不能バグ修正（Phase 3.15）

**Sprint**: Phase 3.15
**Date**: 2026-04-02
**Status**: Build 中

---

## 背景・課題

ログイン後に登録した e-Stat API キーが検索時に取得できない。

**根因**: `catalog/lib/api.ts` の `searchDatasets()` と `fetchDataset()` が Bypass API 呼び出し時に
Authorization ヘッダーを付与していない。Bypass 側の `get_current_user_optional` はトークンなしで
`user_id=None` を返すため、`(user_id, "estat")` で保存したキーが `(None, "estat")` で検索され見つからない。

保存（POST /api/credentials）と状態確認（GET /auth/credentials/.../status）は accessToken を送信しているため動作する。
**検索・取得パスのみヘッダーが欠落**。

---

## 目標・非目標

### 目標

- `searchDatasets()` と `fetchDataset()` で accessToken を Bypass に送信する
- ログイン後に登録した API キーが検索時に使われることを確認する

### 非目標

- Bypass 側のクレデンシャルストア統一（調査の結果、Bypass 側は正常に動作している）
- DynamoDB バックエンドの修正

---

## 修正対象

### catalog/lib/api.ts — 必須

- `searchDatasets()`: accessToken パラメータを追加、Authorization ヘッダーを付与
- `fetchDataset()`: 同上
- `getSearchUrl()`: サーバーサイドでのヘッダー付与に対応

### catalog/app/search/page.tsx, catalog/app/page.tsx 等 — 呼び出し側

- RSC から `auth()` でセッションを取得し、`accessToken` を各関数に渡す

---

## 成功指標

- [ ] searchDatasets() が Authorization ヘッダーを送信する
- [ ] fetchDataset() が Authorization ヘッダーを送信する
- [ ] 既存テスト全 pass
- [ ] E2E テスト全 pass

---

## リスクと前提

### R1: RSC からの auth() 呼び出し

サーバーサイドレンダリング中に `auth()` でセッションを取得する必要がある。
Next.js App Router の RSC では `auth()` が利用可能（next-auth v5 の機能）。
