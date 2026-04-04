# DESIGN — S3 キャッシュ層導入（Phase 6）

**Sprint**: Phase 6
**Date**: 2026-04-04
**Status**: Plan Lock ✓

---

## 背景・課題

Bypass → 外部 API（e-Stat, data.go.jp, e-Gov 法令, 気象庁）のレスポンスが不安定で、
300 秒超のタイムアウトが頻発する。SSR → クライアントサイド fetch への移行（Phase 5）でも
根本解決に至らなかった。

**根本原因**: Catalog がユーザーリクエスト起点で外部 API をリアルタイム呼び出しする構造。
外部 API のレイテンシ・可用性に Catalog の表示速度が完全に依存している。

---

## 目標・非目標

### 目標

- 外部 API からのデータ取得をユーザーリクエストから切り離す
- データセットメタデータを S3 に定期蓄積し、Catalog は S3 から読む
- ホームページ・検索結果を 1 秒未満で表示する
- 外部 API 障害時もキャッシュデータで表示を継続する

### 非目標

- リアルタイムデータの提供（行政データは日次〜月次更新のため不要）
- 全文データの S3 キャッシュ（メタデータのみ。個別デー���セット取得は引き続き Bypass 経由）
- Bypass の廃止（認証・個別データ取得・コネクターロジックは Bypass に残す）

---

## アーキテクチャ

### 変更前（リアルタイム取得）

```
ユーザー → Catalog → /api/browse → Bypass Lambda → 外部 API
                                                     ↑ ここが不安定（300秒超）
```

### 変更後（定期取得 + S3 キャッシュ）

```
[定期取得パス]
EventBridge (定期) → Collector Lambda → 外部 API → S3 バケット

[表示パス]
ユーザー → Catalog → /api/browse → S3 (JSON) → 即時レスポンス
```

### コンポーネント

| コンポーネント | 役割 | 新規/既存 |
|--------------|------|----------|
| Collector Lambda | 外部 API からメタデータを取得し S3 に書き込む | 新規 |
| S3 バケット | データセットメタデータの JSON ストア | 新規 |
| EventBridge ルール | Collector を定期実行（例: 6 時間ごと） | 新規 |
| `/api/browse` | S3 から読み取りに変更 | 既存改修 |
| `/api/search` | S3 上のデータからキーワード検索 | 既存改修 |
| Bypass | 認証・個別データ取得・コネクターロジック | 既存維持 |

---

## S3 データ構造

```
s3://openhub-cache/
  catalog/
    metadata.json          # 全データセットメタデータの統合ファイル
    sources/
      estat.json           # e-Stat のメタデータ
      datagojp.json        # data.go.jp のメタデータ
      egov_law.json        # e-Gov 法令のメタデータ
      jma.json             # 気象庁のメタデータ
    last_updated.json      # 最終更新タイムスタンプ
```

---

## 定期取得スケジュール

| ソース | 更新頻度（実態） | 取得間隔 | 理由 |
|--------|----------------|---------|------|
| e-Stat | 月次〜四半期 | 6 時間 | 十分な鮮度 |
| data.go.jp | 日次〜月次 | 6 時間 | 十分な鮮度 |
| e-Gov 法令 | 不定期 | 6 時間 | 法令改正は即時性不要 |
| 気象庁 | リアルタイム | 1 時間 | 天気予報・警報は鮮度重要 |

---

## Catalog → S3 アクセス方式

**方式 A: AWS SDK で直接 S3 GetObject** を採用。

| 方式 | メリット | デメリット |
|------|---------|-----------|
| A) AWS SDK 直接（採用） | レイテンシ最小、パブリックアクセス不要 | Lambda に IAM ロール必要 |
| B) CloudFront + 静的ホスティング | CDN キャッシュ | 構成が複雑、Phase 6 では過剰 |
| C) S3 Object URL fetch | 簡素 | パブリックアクセス必要、セキュリティ懸念 |

Amplify SSR Lambda（`/api/browse`, `/api/search`）に S3 読み取り権限を付与し、
`@aws-sdk/client-s3` で JSON を取得する。

---

## Collector Lambda の実装方式

**Bypass コネクターを再利用する。**

Collector Lambda は既存の `EStatConnector`, `DataGoJpConnector`, `EGovLawConnector`, `JmaConnector` の
`search()` メソッドを呼び出してメタデータを収集し、JSON として S3 に書き込む。

- Bypass パッケージ内に `collector/` ディレクトリを新設
- 各コネクターの `search()` を順次呼び出し（並列不要 — バッチ処理のため）
- 外部 API タイムアウト: 5 分 / コネクター、Lambda 全体: 15 分

---

## IaC（Infrastructure as Code）

既存 `bypass/template.yaml` に以下のリソースを追加:

| リソース | タイプ | 説明 |
|---------|--------|------|
| `CacheBucket` | `AWS::S3::Bucket` | メタデータ JSON ストア |
| `CollectorFunction` | `AWS::Serverless::Function` | 定期取得 Lambda |
| `CollectorSchedule` | `AWS::Events::Rule` | EventBridge 定期実行ルール |
| `CollectorPolicy` | IAM Policy | S3 書き込み + Bypass コネクター呼び出し |
| `BrowseS3Policy` | IAM Policy | Amplify SSR Lambda の S3 読み取り権限 |

---

## 検索ロジック

S3 上の `metadata.json` に対する in-memory キーワードマッチ:

- **対象フィールド**: `title`, `description`, `tags`
- **マッチ方式**: 部分一致（大文字小文字無視）
- **フィルタリング**: `source_id` による絞り込み
- **ページネーション**: offset/limit ベース（現行と同一）

現行 Bypass の検索は各コネクターの `search()` に依存しているが、
S3 版では統合 JSON に対してフィルタリングするため、全ソース横断検索がより高速になる。

---

## テスト計画

### Collector Lambda

| テスト種別 | 対象 | ツール |
|-----------|------|--------|
| ユニット | 各コネクター → JSON 変換ロジック | pytest + moto（S3 モック） |
| 統合 | Collector → S3 書き込み → JSON 読み取り | pytest + moto |
| 異常系 | 外部 API タイムアウト時のリトライ・スキップ | pytest（httpx モック） |

### Catalog API Route（S3 読み取り）

| テスト種別 | 対象 | ツール |
|-----------|------|--------|
| ユニット | `/api/browse` S3 JSON → レスポンス変換 | vitest + S3 fetch モック |
| ユニット | `/api/search` キーワードフィルタリング | vitest |
| 統合 | S3 JSON → browse → 画面表示 | Playwright |

### カバレッジ目標: 80%+

---

## 完了条件（DoD）

### 計測方法

| 指標 | 計測方法 | 基準 |
|------|---------|------|
| 表示速度 | ブラウザ DevTools の TTFB + FCP | < 1 秒 |
| Collector 動作 | S3 `last_updated.json` のタイムスタンプ | 直近スケジュール内に更新 |
| 耐障害性 | 外部 API を意図的にブロック → Catalog 表示確認 | キャッシュデータで表示継続 |
| テスト | `vitest run` + `pytest` | 全 pass、カバレッジ 80%+ |

### 受け入れ基準

- [ ] S3 に全ソースのメタデータ JSON が書き込まれている
- [ ] EventBridge ルールが定期実行されている
- [ ] `/api/browse` が S3 から読み取ってレスポンスを返す
- [ ] `/api/search` が S3 JSON に対してキーワード検索できる
- [ ] 外部 API 停止時もキャッシュデータで表示が継続する
- [ ] ホームページ FCP < 1 秒
- [ ] 全テスト pass、カバレッジ 80%+

---

## 成功指標

- [ ] ホームページが 1 秒未満で表示される
- [ ] 検索結果が 1 秒未満で表示される
- [ ] 外部 API 停止時もキャッシュデータで表示が継続する
- [ ] 既存テスト全 pass
- [ ] Collector Lambda が定期実行され S3 にデータが書き込まれる

---

## リスクと前提

### R1: データ鮮度

定期取得の間隔内に外部 API のデータが更新された場合、Catalog に反映されるまでラグがある。
行政データは日次〜月次更新のため、6 時間間隔であれば実用上問題ない。
気象庁データのみ 1 時間間隔で対応。

### R2: S3 コスト

メタデータ JSON は数 MB 程度。S3 Standard の読み取りコストは無視できるレベル。
CloudFront を前段に置けばさらに削減可能だが、Phase 6 では非目標。

### R3: Collector Lambda のタイムアウト

外部 API のレスポンスが遅い問題は Collector でも発生する。
ただしユーザーリクエストと切り離されているため、リトライ・長時間タイムアウト設定が可能。
Lambda の最大タイムアウト（15 分）で十分。

### R4: 検索機能の実装

現在 Bypass が担っている検索ロジック（キーワードマッチ）を
S3 上の JSON に対して実行する必要がある。
メタデータ規模が小さい間は in-memory フィルタリングで十分。

---

## 過去の経緯

### Phase 3.16B: ISR キャッシュ導入

Next.js の `revalidate` で Bypass への不要なリクエストを削減。
ただし ISR キャッシュの初回リクエストは外部 API を呼び出すため、根本解決には至らず。

### Phase 5: SSR → クライアントサイド fetch 移行

ホームページの SSR データ取得をクライアントサイドに移行。
ページシェルは即時表示されるようになったが、データ取得自体のレイテンシは未解決。
