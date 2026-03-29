# アーキテクチャ — OpenHub Bypass

## ディレクトリ構成

```
bypass/
├── main.py                  # FastAPI アプリファクトリ・エントリーポイント
├── api/
│   ├── auth.py              # POST/DELETE /auth/credentials（JWT 保護）
│   └── datasets.py          # GET /datasets/search, GET /datasets/{id}/fetch
├── connectors/
│   ├── estat.py             # e-Stat コネクター
│   └── datagojp.py          # data.go.jp（CKAN）コネクター
├── core/
│   ├── auth.py              # Cognito JWT 検証 FastAPI Dependency（get_current_user）
│   ├── connector.py         # DataSourceConnector Protocol 定義
│   ├── models.py            # DatasetMetadata / DatasetPayload（frozen dataclass）
│   ├── errors.py            # ドメイン例外クラス
│   ├── cache.py             # InMemoryCache（TTL 付き、スレッドセーフ）
│   └── credentials.py       # CredentialStore（インメモリ APIキー管理）
└── tests/
    ├── conftest.py           # 共有フィクスチャ（autouse キャッシュクリア・auth override 含む）
    ├── fixtures/             # テスト用 JSON フィクスチャ
    └── test_*.py             # テストファイル
```

## レイヤー構成

```
┌─────────────────────────────────────┐
│  FastAPI Router (api/)              │  ← HTTP 層：バリデーション・シリアライズ
│    └── Depends(get_current_user)    │  ← JWT 検証（認証が必要なエンドポイント）
├─────────────────────────────────────┤
│  Domain Services (datasets.py)      │  ← ビジネスロジック：キャッシュ・エラー変換
├─────────────────────────────────────┤
│  Connectors (connectors/)           │  ← 上流 API アダプター
├─────────────────────────────────────┤
│  Core (core/)                       │  ← ドメインモデル・インフラ・認証
│    └── auth.py: JWT Dependency      │  ← JWKS 取得・RS256 検証・sub 返却
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

APIキー（e-Stat はアプリケーションID）はサーバー側に永続化しない。
`POST /auth/credentials` で登録したインメモリストアから取得する。
プロセス再起動でリセットされる。

キー登録時は検索キャッシュを全クリアする（キャッシュポイズニング防止）。

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

### Cognito JWT 認証（Sprint 3.1）

`/auth/credentials` エンドポイントは Cognito が発行する RS256 JWT で保護されている。

```
Authorization: Bearer <Cognito JWT>
```

`core/auth.py` の `get_current_user` FastAPI Dependency が検証を担当:
1. `JWKS_URL`（Cognito の `.well-known/jwks.json`）から公開鍵セットを取得
2. `lru_cache(maxsize=1)` でプロセス内キャッシュ（Cognito レート制限回避）
3. JWT ヘッダーの `kid` で一致する公開鍵を選択
4. `python-jose` で RS256 署名・有効期限・audience・issuer を検証
5. 検証成功時は `payload["sub"]`（Cognito user_id）を返す

ローカル開発は `DISABLE_AUTH=true` 環境変数でスキップ（`"local_dev_user"` を返す）。

テストでは `app.dependency_overrides[get_current_user] = lambda: "test_user"` で既存テストを保護。

### バイナリフォーマット対応

`shapefile` / `binary` フォーマットは `base64.b64encode` してレスポンスに含める。
`PayloadResponse.data_encoding` フィールドでクライアントがデコード方式を判断できる。

## 既知の制限

| 制限 | 内容 | 対応予定 |
|------|------|---------|
| `total` が返却件数 | 全ヒット件数は未取得（ページネーション未実装） | Phase 3 |
| datagojp fetch がメタデータを返す | `package_show` の結果のみ | Phase 3 |
| シングルワーカー専用 | CredentialStore がプロセス内シングルトン | Phase 3 |
| fetch キャッシュなし | 同一 ID へのリクエストが毎回上流へ | Phase 3 |
| APIキー永続化なし | Bypass 再起動でリセット | Phase 3 |
