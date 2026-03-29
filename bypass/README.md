# OpenHub Bypass

日本の行政オープンデータを横断検索・取得する REST API ゲートウェイ。

## 概要

複数の行政オープンデータポータルを統一 API で横断検索し、データを取得できる。
**BYOK（Bring Your Own Key）モデル**：APIキーはサーバーに永続化せず、セッション内でのみ保持。

OpenHub Catalog（Next.js WebUI）と連携して動作する BFF（Backend for Frontend）。

## 対応データソース

| ソース | source_id | 認証 | 説明 |
|--------|-----------|------|------|
| e-Stat 政府統計の総合窓口 | `estat` | アプリケーションID 必須 | 国勢調査・経済統計等 |
| data.go.jp 政府オープンデータ | `datagojp` | 不要 | CKAN ベースの汎用ポータル（data.e-gov.go.jp） |

## セットアップ

```bash
cd bypass
pip install -e ".[dev]"
```

## 起動

```bash
# ローカル専用（シングルワーカー）
python main.py
# または
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
```

> **注意**: `--workers 2` 以上は非対応。CredentialStore はプロセス内シングルトンのため、
> 複数ワーカーではAPIキーが共有されない。

### 認証の設定

本番（Cognito あり）は以下の環境変数が必要:
```bash
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
COGNITO_CLIENT_ID=your_cognito_app_client_id
```

ローカル開発（Cognito なし）は認証をスキップできる:
```bash
DISABLE_AUTH=true python main.py
```

API ドキュメント（Swagger UI）: http://127.0.0.1:8000/docs

## API エンドポイント

> **認証が必要なエンドポイント**（`DISABLE_AUTH=true` 以外）は `Authorization: Bearer <JWT>` ヘッダーが必要。
> JWT は Amazon Cognito が発行する RS256 トークン。

### 認証

```
POST /auth/credentials                        APIキー（アプリケーションID）を登録する（登録後はキャッシュが自動クリア）
GET  /auth/credentials/{source_id}/status     APIキーの設定状態を確認する（configured: bool のみ返す）
```

**リクエスト例（e-Stat のアプリケーションIDを登録）:**
```json
POST /auth/credentials
{
  "source_id": "estat",
  "api_key": "your_estat_application_id"
}
```

### データセット

```
GET /datasets/search              横断検索
GET /datasets/{id}/fetch          データセット取得
```

**検索パラメータ:**
| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `q` | string | 必須 | 検索キーワード |
| `source` | string | 全ソース | ソース絞り込み（例: `estat`） |
| `limit` | int | 20 | 取得件数（1〜100） |
| `offset` | int | 0 | オフセット |

**dataset_id フォーマット:**
```
{source_id}:{original_id}
例: estat:0003191203
    datagojp:mlit-test-dataset
```

**SearchResponse の `total` について:**
現在 `total` は**返却件数**（= `len(items)`）を示す。全ヒット件数ではない。

## テスト

```bash
pytest tests/ -v
pytest tests/ --cov=. --cov-report=term-missing   # カバレッジ付き
```

統合テスト（実 API 呼び出し）は `ESTAT_API_KEY` 環境変数が必要:
```bash
ESTAT_API_KEY=your_key pytest tests/ -m integration
```

## ロードマップ

| フェーズ | 内容 |
|---------|------|
| Phase 1 | e-Stat + data.go.jp（リリース済み） |
| Phase 2 | Catalog WebUI との連携・バグ修正群（リリース済み） |
| Sprint 3.1 | Cognito JWT 認証基盤（リリース済み） |
| Sprint 3.2 | DynamoDB CredentialStore（APIキー永続化・ユーザー分離） |
| Phase 4 | データソース拡張（国土数値情報・e-Gov 法令等） |
