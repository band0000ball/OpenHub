# OpenHub Bypass — Phase 1

日本の行政オープンデータを横断検索・取得する REST API ゲートウェイ。

## 概要

複数の行政オープンデータポータルを統一 API で横断検索し、データを取得できる。
**BYOK（Bring Your Own Key）モデル**：APIキーはサーバーに永続化せず、セッション内でのみ保持。

## 対応データソース（Phase 1）

| ソース | source_id | 認証 | 説明 |
|--------|-----------|------|------|
| e-Stat 政府統計の総合窓口 | `estat` | APIキー必須 | 国勢調査・経済統計等 |
| data.go.jp 政府オープンデータ | `datagojp` | 不要 | CKAN ベースの汎用ポータル |

## セットアップ

```bash
cd openhub
pip install -e ".[dev]"
```

## 起動

```bash
# Phase 1: ローカル専用（シングルワーカー）
python main.py
# または
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
```

> **注意**: `--workers 2` 以上は非対応。CredentialStore はプロセス内シングルトンのため、
> 複数ワーカーではAPIキーが共有されない。

API ドキュメント（Swagger UI）: http://127.0.0.1:8000/docs

## API エンドポイント

### 認証

```
POST   /auth/credentials          APIキーを登録する
DELETE /auth/credentials/{id}     APIキーを削除する
```

**リクエスト例（e-Stat のキーを登録）:**
```json
POST /auth/credentials
{
  "source_id": "estat",
  "api_key": "your_estat_api_key"
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

**SearchResponse の `total` について:**
現フェーズでは `total` は**返却件数**（= `len(items)`）を示す。
全ヒット件数ではない。ページネーション対応は Phase 2 で実装予定。

**dataset_id フォーマット:**
```
{source_id}:{original_id}
例: estat:0003191203
    datagojp:mlit-test-dataset
```

**data.go.jp の fetch について:**
`/fetch` エンドポイントは現在 CKAN の `package_show` レスポンス（メタデータ）を返す。
実データファイルの直接取得は Phase 2 で `resources[].url` への別途リクエストとして実装予定。

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
| Phase 1 | e-Stat + data.go.jp（本リリース） |
| Phase 2 | 国土数値情報 + WebUI（OpenHub Catalog） |
| Phase 3 | e-Gov 法令 + e-Gov パブコメ |
| Phase 4 | RESAS + 気象データ（JMA） |
