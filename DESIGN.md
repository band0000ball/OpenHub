# DESIGN — BOJ 日銀統計 API コネクター追加（Phase 8.2）

**Sprint**: Phase 8.2
**Date**: 2026-04-05
**Status**: Plan Lock ✓

---

## 背景・課題

OpenHub は行政データ（e-Stat, data.go.jp, e-Gov 法令, 気象庁）と学術データ（CiNii）を
横断検索できるが、金融統計データは未対応。2026年2月に BOJ が新 API を公開し、
認証不要で 20 万系列以上の金融統計にアクセス可能になった。

---

## 目標・非目標

### 目標

- BOJ 時系列統計データをキーワード検索できる
- ホームページのソース別セクションに BOJ が表示される
- Collector が定期的に BOJ メタデータを S3 に蓄積する

### 非目標

- 時系列データ本体の取得・可視化（メタデータのみ）
- 全 20 万系列の網羅（代表的なカテゴリを収集）

---

## BOJ API 仕様

| 項目 | 内容 |
|------|------|
| ベース URL | `https://www.stat-search.boj.or.jp/api/v1` |
| 認証 | 不要 |
| フォーマット | JSON（`format=json`） |
| 主要 API | `/getMetadata`（系列メタデータ）, `/getDataCode`（データ取得） |
| ページネーション | `NEXTPOSITION` トークン方式（1回最大 250 件） |
| レート制限 | 明示的な記載なし（リクエスト間 1 秒待機推奨） |

### /getMetadata パラメータ

| パラメータ | 内容 |
|-----------|------|
| `db` | データベース ID（例: FM08, CO, MD10） |
| `keyword` | キーワード検索 |
| `lang` | JP / EN |
| `format` | json / csv |

### 主要データベース ID

| DB ID | カテゴリ | 内容 |
|-------|---------|------|
| FM08 | 為替 | 主要通貨の為替レート |
| IR01 | 金利 | 短期・長期金利 |
| MD10 | マネーストック | M1, M2, M3 |
| BP01 | 国際収支 | 経常収支・金融収支 |
| CO | 企業物価 | 国内企業物価指数 |
| ST | 短観 | 全国企業短期経済観測 |

---

## 実装方針: メタデータカタログ型

JMA コネクターと同じパターン。

1. 代表的な DB ID で `/getMetadata` を呼び出し、系列メタデータを取得
2. DatasetMetadata にマッピングして S3 に蓄積
3. 検索は S3 キャッシュ上の in-memory マッチ

### レスポンスフィールドマッピング

| BOJ フィールド | OpenHub DatasetMetadata | 備考 |
|---------------|------------------------|------|
| 系列名 | `title` | |
| データベース名 + 説明 | `description` | |
| 系列コード | `id` → `boj:{code}` | |
| stat-search URL | `url` | Web 閲覧ページ |
| DB カテゴリ | `tags` | 為替, 金利 等 |
| 最終更新日 | `updated_at` | |

---

## 実装コンポーネント

| コンポーネント | ファイル | 変更 |
|--------------|---------|------|
| BojConnector | `bypass/connectors/boj.py` | 新規 |
| ソース登録 | `bypass/api/datasets.py` | _SOURCE_REGISTRY に追加 |
| Collector 収集戦略 | `bypass/collector/handler.py` | DB ID 別に /getMetadata を呼び出す専用戦略 |
| Catalog ソース定義 | `catalog/lib/sources.ts` | FALLBACK_SOURCES に追加 |
| S3 キャッシュ | `bypass/api/cache.py` | ソース一覧に boj 追加 |

---

## Collector 収集戦略

代表的な DB ID（FM08, IR01, MD10, BP01, CO, ST 等）で `/getMetadata` を呼び出し、
NEXTPOSITION トークンでページネーションして全系列を取得。

既存の `_collect_by_keywords` とは異なり、キーワードではなく **DB ID** で分類して収集する。

---

## テスト計画

| テスト | ファイル | ツール |
|--------|---------|--------|
| BojConnector ユニット | `bypass/tests/test_connector_boj.py` | pytest + respx |
| Collector 統合 | 既存テストに boj 追加 | pytest + moto |
| Catalog ソース表示 | 既存テストに boj 追加 | vitest |

カバレッジ目標: 80%+

---

## 成功指標

- [ ] BOJ のデータがホームページのソース別セクションに表示される
- [ ] キーワード検索で BOJ の金融統計がヒットする
- [ ] Collector が BOJ メタデータを S3 に蓄積する
- [ ] 全テスト pass、カバレッジ 80%+

---

## リスクと前提

### R1: NEXTPOSITION ページネーション

既存コネクターの offset/limit 方式と異なる。BojConnector の search() 内で
NEXTPOSITION トークンを内部的に処理し、offset/limit インターフェースに合わせる。

### R2: データ量

20 万系列は全収集すると Collector タイムアウト（120秒/ソース）に収まらない可能性。
代表的な DB ID に絞って収集する。

### R3: レート制限

リクエスト間 1 秒待機を実装して過度なアクセスを回避する。
