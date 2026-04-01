# OpenHub Bypass

日本の行政オープンデータを横断検索・取得する REST API ゲートウェイ。

## 概要

複数の行政オープンデータポータルを統一 API で横断検索し、データを取得できる。
**BYOK（Bring Your Own Key）モデル**：APIキーは Cognito user_id で分離して管理。`CREDENTIAL_STORE_BACKEND=dynamodb` で DynamoDB に永続化（デフォルトはインメモリ）。

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

DynamoDB CredentialStore（本番用）:
```bash
CREDENTIAL_STORE_BACKEND=dynamodb
DYNAMODB_TABLE_NAME=openhub-credentials
AWS_REGION=ap-northeast-1
```

デモ・ローカル（デフォルト、AWS 不要）:
```bash
# CREDENTIAL_STORE_BACKEND=memory が既定値（設定不要）
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
`total` は**全ヒット件数**を示す。上流 API が件数を返せない場合は `null`。
`has_next` は次ページが存在する場合に `true`（`total=null` 時の判定はこちらを使用）。
複数ソース横断時（`source` 未指定）は各ソースの `total` を合算する。いずれかが失敗した場合は `total=null`。

## Lambda デプロイ（Sprint 3.3）

AWS Lambda + Mangum アダプターでデプロイする。

```bash
cd bypass
pip install -e ".[lambda]"
pip freeze > requirements.txt   # SAM ビルド前に毎回実行
sam build
sam deploy --guided
# → Function URL が発行される
```

`template.yaml` に SAM テンプレートが含まれている。`samconfig.toml` と `.env.lambda` は `.gitignore` 済み。

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
| Sprint 3.2 | DynamoDB CredentialStore（APIキー永続化・ユーザー分離）（リリース済み） |
| Sprint 3.3 | Lambda + Amplify デプロイ基盤（リリース済み） |
| Sprint 3.4 | ページネーション（SearchResponse に total/has_next/limit/offset）（リリース済み） |
| Sprint 3.5 | data.go.jp エンコーディング調査（再現不可・実装正常を確認）（リリース済み） |
| Phase 4 | データソース拡張（国土数値情報・e-Gov 法令等） |
