# DESIGN — J-SHIS 地震ハザードコネクター追加（Phase 8.4）

**Sprint**: Phase 8.4
**Date**: 2026-04-05
**Status**: Plan Lock ✓

---

## 背景・課題

OpenHub は気象庁の天気予報・警報を提供するが、地震ハザード情報は未対応。
J-SHIS（地震ハザードステーション、防災科研提供）は認証不要で地震ハザード・
活断層・地盤構造データを提供する。

---

## 目標・非目標

### 目標

- J-SHIS の地震ハザード関連データをキーワード検索できる
- ホームページのソース別セクションに J-SHIS が表示される
- 静的カタログ JSON で主要データを定義する

### 非目標

- メッシュ単位の詳細ハザード値の取得・表示（座標指定 API は OpenHub の検索と相性が悪い）
- GeoJSON の地図表示

---

## J-SHIS API 仕様

| 項目 | 内容 |
|------|------|
| ベース URL | `https://www.j-shis.bosai.go.jp/map/api/` |
| 認証 | 不要 |
| 方式 | メッシュコード・座標・地域コードでの個別取得 |
| キーワード検索 | **なし** |
| レスポンス | GeoJSON / JSON / XML |

---

## 実装方針: 静的メタデータカタログ

JMA コネクターと同じパターン。`jshis_catalog.json` に以下のカテゴリのエントリを事前定義する。

### カタログ構成

| カテゴリ | エントリ数（目安） | 内容 |
|---------|-----------------|------|
| 地震ハザード評価 | ~50 | 確率論的地震動予測地図（各評価期間・超過確率） |
| 主要活断層帯 | ~114 | 地震調査委員会が公表した主要活断層帯 |
| 地盤構造 | ~10 | 表層地盤・深部地盤（全国） |
| 地すべり地形 | ~10 | 地域別地すべり地形分布 |

### 各エントリの構造

```json
{
  "id": "jshis:pshm_Y2024_AVR_TTL_MTTL",
  "title": "確率論的地震動予測地図 2024年版 全評価期間 全地震",
  "description": "今後30年間に震度6弱以上の揺れに見舞われる確率の分布",
  "url": "https://www.j-shis.bosai.go.jp/map/JSHIS2/...",
  "tags": ["地震ハザード", "確率論的地震動予測"],
  "api_path": "pshm/Y2024/AVR/TTL_MTTL/meshinfo.geojson"
}
```

---

## 実装コンポーネント

| コンポーネント | ファイル | 変更 |
|--------------|---------|------|
| 静的カタログ | `bypass/connectors/jshis_catalog.json` | 新規 |
| JshisConnector | `bypass/connectors/jshis.py` | 新規 |
| ソース登録 | `bypass/api/datasets.py` | _SOURCE_REGISTRY に追加 |
| Collector | 既存 `_collect_default` を使用（カタログから全件取得） |
| Catalog ソース定義 | `catalog/lib/sources.ts` | FALLBACK_SOURCES に追加 |
| S3 キャッシュ | `bypass/api/cache.py` | ソース一覧に jshis 追加 |

---

## テスト計画

| テスト | ファイル | ツール |
|--------|---------|--------|
| JshisConnector ユニット | `bypass/tests/test_connector_jshis.py` | pytest + respx |

カバレッジ目標: 80%+

---

## 成功指標

- [ ] J-SHIS のデータがホームページのソース別セクションに表示される
- [ ] キーワード検索で地震ハザード関連データがヒットする
- [ ] 全テスト pass、カバレッジ 80%+

---

## リスクと前提

### R1: カタログの網羅性

静的カタログのため、J-SHIS が新しいデータを追加しても自動反映されない。
定期的にカタログを更新する運用が必要。

### R2: fetch の実装

個別データの取得は座標・メッシュコードが必要。
fetch() は J-SHIS の Web ページ URL にリダイレクトする簡易実装とする。
