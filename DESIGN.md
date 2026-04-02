# DESIGN — Catalog テスト環境修正（Phase 3.14）

**Sprint**: Phase 3.14
**Date**: 2026-04-02
**Status**: Think 完了 / Plan 待ち

---

## 背景・課題

`proxy.test.ts` と `api.credentials.test.ts` が `next/server` の ESM モジュール解決エラーで失敗している。
next-auth v5 beta の `env.js` が `import { NextRequest } from "next/server"` を実行するが、
Vitest の jsdom 環境では ESM resolver が `next/server` をディレクトリパスとして解決しようとし失敗する。

```
Error: Cannot find module '.../node_modules/next/server'
imported from .../node_modules/next-auth/lib/env.js
Did you mean to import "next/server.js"?
```

サーバーサイドコード（proxy.ts, route.ts）のユニットテストが実行不能な状態にある。

---

## 目標・非目標

### 目標

- `npx vitest run` で `proxy.test.ts` と `api.credentials.test.ts` が pass する
- 既存テスト（auth.test.ts 等）が引き続き pass する

### 非目標

- テストケースの追加・拡充（Phase 3.13 のスコープ）
- next-auth のバージョンアップ

---

## 制約条件

- next-auth v5.0.0-beta.30 は ESM モジュール。`env.js` が `next/server` を import する
- `auth.test.ts` は `vi.mock("next-auth", ...)` で先にモックするため問題が発生しない
- `proxy.test.ts` / `api.credentials.test.ts` は実モジュールを import するため失敗する

---

## 成功指標

- [ ] `npx vitest run` で全テストが pass する
- [ ] proxy.test.ts のテストケースが実行される
- [ ] api.credentials.test.ts のテストケースが実行される
- [ ] 既存テスト（auth.test.ts 等）に影響がない

---

## リスクと前提

### R1: next-auth v5 beta の ESM 互換性

next-auth の内部実装に依存するため、単純な設定変更で解決しない可能性がある。
→ 複数アプローチ（node 環境分離、エイリアス、モック）を試す
