# アーキテクチャ — OpenHub Bypass Phase 1

## ディレクトリ構成

```
openhub/
├── main.py                  # FastAPI アプリファクトリ・エントリーポイント
├── api/
│   ├── auth.py              # POST/DELETE /auth/credentials
│   └── datasets.py          # GET /datasets/search, GET /datasets/{id}/fetch
├── connectors/
│   ├── estat.py             # e-Stat コネクター
│   └── datagojp.py          # data.go.jp（CKAN）コネクター
├── core/
│   ├── connector.py         # DataSourceConnector Protocol 定義
│   ├── models.py            # DatasetMetadata / DatasetPayload（frozen dataclass）
│   ├── errors.py            # ドメイン例外クラス
│   ├── cache.py             # InMemoryCache（TTL 付き、スレッドセーフ）
│   └── credentials.py       # CredentialStore（インメモリ APIキー管理）
└── tests/
    ├── conftest.py           # 共有フィクスチャ（autouse キャッシュクリア含む）
    ├── fixtures/             # テスト用 JSON フィクスチャ
    └── test_*.py             # テストファイル
```

## レイヤー構成

```
┌─────────────────────────────────────┐
│  FastAPI Router (api/)              │  ← HTTP 層：バリデーション・シリアライズ
├─────────────────────────────────────┤
│  Domain Services (datasets.py)      │  ← ビジネスロジック：キャッシュ・エラー変換
├─────────────────────────────────────┤
│  Connectors (connectors/)           │  ← 上流 API アダプター
├─────────────────────────────────────┤
│  Core (core/)                       │  ← ドメインモデル・インフラ
└─────────────────────────────────────┘
```

## 主要設計決定

### DataSourceConnector Protocol（Duck Typing）

新しいデータソースを追加するには `DataSourceConnector` Protocol を実装したクラスを作り、
`_CONNECTOR_FACTORIES` に登録するだけでよい。

```python
# core/connector.py
class DataSourceConnector(Protocol):
    source_id: str
    source_name: str
    def initialize(self, api_key: str | None) -> None: ...
    def search(self, query: str, filters: dict) -> list[DatasetMetadata]: ...
    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload: ...

# api/datasets.py
_CONNECTOR_FACTORIES: dict[str, type] = {
    "estat": EStatConnector,
    "datagojp": DataGoJpConnector,
    # Phase 2: "kokudo": KokudoConnector,
}
```

### BYOK モデル

APIキーはサーバー側に永続化しない。リクエストごとに `X-` ヘッダーまたは
`POST /auth/credentials` で登録したインメモリストアから取得する。
プロセス再起動でリセットされる。

### InMemoryCache

- TTL: デフォルト 24時間（`_SEARCH_CACHE_TTL`）
- Stale data 非返却（TTL 経過後は None を返し、上流から再取得）
- キャッシュキー: `\x00` 区切り（ユーザー入力のインジェクション防止）
- テスト間干渉防止: `conftest.py` の `autouse=True` フィクスチャでクリア

### イミュータブルドメインモデル

`DatasetMetadata` と `DatasetPayload` は `@dataclass(frozen=True)` で定義。
`tags` は `tuple[str, ...]`（`list` は frozen dataclass と不整合のため禁止）。

### エラーハンドリング

上流例外 → ドメイン例外 → HTTP レスポンスの3層変換:

```
httpx.TimeoutException → UpstreamTimeoutError → 504 Gateway Timeout
httpx.Response(403)    → AuthenticationError  → 401 Unauthorized
httpx.Response(429)    → UpstreamRateLimitError → 429 + Retry-After
httpx.Response(404)    → DatasetNotFoundError  → 404 Not Found
```

`from None` を使い、httpx 例外チェーンに含まれる URL（APIキー含む可能性）の漏洩を防ぐ。

### バイナリフォーマット対応

`shapefile` / `binary` フォーマットは `base64.b64encode` してレスポンスに含める。
`PayloadResponse.data_encoding` フィールドでクライアントがデコード方式を判断できる。

## 既知の制限（Phase 1）

| 制限 | 内容 | 対応予定 |
|------|------|---------|
| `total` が返却件数 | 全ヒット件数は未取得 | Phase 2 |
| datagojp fetch がメタデータを返す | `package_show` の結果のみ | Phase 2 |
| シングルワーカー専用 | CredentialStore がプロセス内シングルトン | Phase 3 |
| fetch キャッシュなし | 同一 ID へのリクエストが毎回上流へ | Phase 2 |
