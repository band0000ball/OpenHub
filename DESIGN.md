# DESIGN — CiNii Research コネクター追加（Phase 8.1）

**Sprint**: Phase 8.1
**Date**: 2026-04-04
**Status**: Plan Lock ✓

---

## 背景・課題

OpenHub は行政オープンデータ（e-Stat, data.go.jp, e-Gov 法令, 気象庁）を横断検索できるが、
学術データは未対応。日本最大の学術情報データベース CiNii Research を追加し、
論文・研究データも含めた横断検索を実現する。

---

## 目標・非目標

### 目標

- CiNii Research の学術論文をキーワード検索できる
- ホームページのソース別セクションに CiNii が表示される
- Collector が定期的に CiNii メタデータを S3 に蓄積する

### 非目標

- 論文全文の取得・表示（メタデータのみ）
- CiNii Books（図書館蔵書）の対応
- API キー認証（認証なしで利用可能）

---

## CiNii Research API 仕様

| 項目 | 内容 |
|------|------|
| エンドポイント | `https://cir.nii.ac.jp/opensearch/all` |
| 認証 | 不要 |
| フォーマット | JSON-LD（`format=json` パラメータ） |
| 検索パラメータ | `q` (キーワード), `count` (件数, max 200), `start` (開始位置, 1-based, max 10000) |
| ページネーション | `opensearch:totalResults`, `opensearch:startIndex`, `opensearch:itemsPerPage` |
| 取得上限 | start 最大 10,000。Collector は最大 10,000 件まで取得可能 |
| レート制限 | 明示的な記載なし（常識的な範囲で利用） |
| 追加フィールド | `dc:subject` (キーワード), `dc:creator` (著者), `prism:publicationName` (刊行物名) |

### レスポンスフィールドマッピング

| CiNii フィールド | OpenHub DatasetMetadata | 備考 |
|-----------------|------------------------|------|
| `title` | `title` | |
| `description` | `description` | HTML タグ除去が必要 |
| `link.@id` | `url` | CiNii の詳細ページ URL |
| `@id` | `id` → `cinii:{CRID}` | CRID を抽出 |
| `dc:type` | `tags` | Article, Book 等 |
| `dc:creator` | `tags` に追加 | 著者名（最大3名） |
| `prism:publicationDate` | `updated_at` | ISO 8601 形式 |

---

## 実装コンポーネント

| コンポーネント | ファイル | 変更 |
|--------------|---------|------|
| CiNiiConnector | `bypass/connectors/cinii.py` | 新規 |
| ソース登録 | `bypass/api/datasets.py` | _SOURCE_REGISTRY に追加 |
| Collector 収集戦略 | `bypass/collector/handler.py` | キーワード検索型（e-Gov 法令と同パターン） |
| Catalog ソース定義 | `catalog/lib/sources.ts` | FALLBACK_SOURCES に追加 |
| S3 キャッシュ | `bypass/api/cache.py` | _get_all_items のソース一覧に追加 |

---

## Collector 収集戦略

CiNii API は `start` 最大 10,000、`count` 最大 200 の制限あり。
汎用収集戦略（`_collect_default`）でページネーション全件取得を行い、最大 10,000 件を収集する。

空クエリ `q=""` で全件取得が可能であれば汎用戦略をそのまま適用。
不可の場合、e-Gov 法令と同様にキーワード検索型戦略を使用。

---

## テスト計画

| テスト | ファイル | ツール |
|--------|---------|--------|
| CiNiiConnector ユニット | `bypass/tests/test_connector_cinii.py` | pytest + respx |
| Collector 統合 | 既存テストに cinii 追加 | pytest + moto |
| Catalog ソース表示 | 既存テストに cinii 追加 | vitest |

カバレッジ目標: 80%+

---

## 成功指標

- [ ] CiNii のデータがホームページのソース別セクションに表示される
- [ ] キーワード検索で CiNii の論文がヒットする
- [ ] Collector が CiNii メタデータを S3 に蓄積する
- [ ] 全テスト pass、カバレッジ 80%+

---

## リスクと前提

### R1: レート制限

CiNii API に明示的なレート制限の記載がない。Collector は常識的な間隔（1秒/リクエスト）で取得する。

### R2: JSON-LD パース

レスポンスが JSON-LD 形式（`@id`, `dc:creator` 等のプレフィックス付き）。
通常の JSON パースで対応可能だが、フィールド名が特殊。

### R3: description の HTML タグ

`description` フィールドに `<p>` 等の HTML タグが含まれる。表示前にタグ除去が必要。
