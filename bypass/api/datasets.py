"""
データセット検索・取得エンドポイント

GET /datasets/search?q=&source=&limit=20&offset=0
GET /datasets/{id}/fetch

設計方針:
- キャッシュ優先（インメモリ + 24時間 TTL）
- 上流タイムアウト 30秒
- レート制限 429 時はバックオフ最大 60秒
- 構造化ログを JSON 形式で出力
"""

import base64
import json
import logging
import re
import time
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from connectors.datagojp import DataGoJpConnector
from connectors.estat import EStatConnector
from core.cache import InMemoryCache
from core.connector import DataSourceConnector
from core.auth import get_current_user_optional
from core.credentials import CredentialStore, get_credential_store
from core.errors import (
    AuthenticationError,
    DatasetNotFoundError,
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)
from core.models import DatasetMetadata, DatasetPayload, SearchResult

router = APIRouter(prefix="/datasets", tags=["データセット"])
sources_router = APIRouter(tags=["ソース"])

# 構造化ログ
logger = logging.getLogger(__name__)

# 検索結果キャッシュ（24時間 TTL）
_SEARCH_CACHE_TTL = 60 * 60 * 24
_search_cache: InMemoryCache[SearchResult] = InMemoryCache(
    ttl_seconds=_SEARCH_CACHE_TTL
)


def get_search_cache() -> InMemoryCache[SearchResult]:
    """検索キャッシュを返す（auth エンドポイントからのクリア用）。"""
    return _search_cache

# dataset_id フォーマット: "{source_id}:{original_id}"
_DATASET_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]+:[a-zA-Z0-9_\-\.]+$")

# バックオフ上限（秒）
_MAX_BACKOFF_SECONDS = 60.0

# バイナリとして扱うフォーマット（base64 エンコードして返す）
_BINARY_FORMATS = frozenset(["shapefile", "binary"])


# ---------------------------------------------------------------------------
# ソース登録（単一ソースオブトゥルース）
# ---------------------------------------------------------------------------


class SourceDefinition(BaseModel):
    """データソース定義。GET /sources で返す情報と一致する。"""
    id: str
    label: str
    requires_api_key: bool


# コネクタークラスとメタデータの登録
_SOURCE_REGISTRY: list[tuple[SourceDefinition, type]] = [
    (SourceDefinition(id="estat", label="e-Stat", requires_api_key=True), EStatConnector),
    (SourceDefinition(id="datagojp", label="data.go.jp", requires_api_key=False), DataGoJpConnector),
]

# source_id → コネクタークラス（検索・取得用）
_CONNECTOR_FACTORIES: dict[str, type] = {
    entry[0].id: entry[1] for entry in _SOURCE_REGISTRY
}

# 有効な source_id のセット
VALID_SOURCES = frozenset(_CONNECTOR_FACTORIES.keys())


def get_source_definitions() -> list[SourceDefinition]:
    """登録済みソース定義を返す。GET /sources エンドポイントで使用。"""
    return [entry[0] for entry in _SOURCE_REGISTRY]


@sources_router.get(
    "/sources",
    response_model=list[SourceDefinition],
    summary="登録済みデータソース一覧を返す",
)
def get_sources() -> list[SourceDefinition]:
    """Catalog がソース定義を同期するためのエンドポイント。"""
    return get_source_definitions()


# ---------------------------------------------------------------------------
# レスポンスモデル
# ---------------------------------------------------------------------------

class MetadataSchema(BaseModel):
    """DatasetMetadata の JSON シリアライズ用スキーマ。"""

    id: str
    source_id: str
    title: str
    description: str
    url: str
    tags: list[str]
    updated_at: str


class SearchResponse(BaseModel):
    """GET /datasets/search レスポンス。"""

    items: list[MetadataSchema]
    total: int | None  # 全ヒット件数。上流が返せない場合は None
    has_next: bool     # 次ページが存在する場合 True
    limit: int
    offset: int


class PayloadResponse(BaseModel):
    """GET /datasets/{id}/fetch レスポンス。"""

    metadata: MetadataSchema
    format: str
    fetched_at: str
    record_count: int | None
    data_encoding: Literal["utf-8", "base64"]
    # data は Base64 エンコード文字列またはテキスト
    data: str


# ---------------------------------------------------------------------------
# 検索エンドポイント
# ---------------------------------------------------------------------------

@router.get(
    "/search",
    response_model=SearchResponse,
    summary="データセットを横断検索する",
)
def get_datasets_search(
    request: Request,
    q: str = Query(..., min_length=1, description="検索キーワード"),
    source: str | None = Query(None, description="ソース絞り込み（例: 'estat'）"),
    limit: int = Query(20, ge=1, le=100, description="取得件数（1〜100）"),
    offset: int = Query(0, ge=0, description="オフセット（0以上）"),
    user_id: str | None = Depends(get_current_user_optional),
    store: CredentialStore = Depends(get_credential_store),
) -> SearchResponse:
    """全ソースを横断検索する。キャッシュヒット時は上流に問い合わせない。

    Raises:
        HTTPException 422: 無効なパラメータ
    """
    if source is not None and source not in VALID_SOURCES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"不明なソース '{source}'。利用可能: {sorted(VALID_SOURCES)}",
        )

    # キャッシュキー: ヌル文字区切りでフィールド境界を明確にする（インジェクション防止）
    cache_key = "\x00".join(["search", q, str(source), str(limit), str(offset)])
    cached = _search_cache.get(cache_key)
    if cached is not None:
        _log_access(request, query=q, source_id=source or "all", x_source="cache")
        return _build_search_response(cached, limit, offset)

    search_result = search_all_sources(q, source, limit, offset, store, user_id)

    _search_cache.set(cache_key, search_result)
    _log_access(request, query=q, source_id=source or "all", x_source="upstream")

    return _build_search_response(search_result, limit, offset)


def search_all_sources(
    query: str,
    source: str | None,
    limit: int,
    offset: int,
    store: CredentialStore,
    user_id: str | None = None,
) -> SearchResult:
    """指定ソース（または全ソース）を検索して結果を返す。

    テストから直接モック可能な独立関数として定義する。
    複数ソース横断時は total_count を合算する。
    いずれかのソースの total_count が None の場合は全体も None とし has_next で判定する。
    """
    connectors = _build_connectors(source, store, user_id)
    filters = {"limit": limit, "offset": offset}

    all_items: list[DatasetMetadata] = []
    total_count: int | None = 0
    has_next = False

    for connector in connectors:
        try:
            result = connector.search(query, filters)
            all_items.extend(result.items)
            if total_count is not None and result.total_count is not None:
                total_count += result.total_count
            else:
                total_count = None
            has_next = has_next or result.has_next
        except AuthenticationError:
            # APIキー未設定のソースはスキップ（エラーにしない）
            logger.warning(
                json.dumps({
                    "event": "search_skipped",
                    "source_id": connector.source_id,
                    "reason": "api_key_not_configured",
                })
            )
        except (UpstreamTimeoutError, UpstreamRateLimitError) as exc:
            # 上流エラーは警告ログを残して続行（他ソースの結果は返す）
            total_count = None  # 失敗ソースの件数不明のため None にフォールバック
            logger.warning(
                json.dumps({
                    "event": "search_upstream_error",
                    "source_id": connector.source_id,
                    "reason": str(exc),
                })
            )

    return SearchResult(items=tuple(all_items), total_count=total_count, has_next=has_next)


# ---------------------------------------------------------------------------
# フェッチエンドポイント
# ---------------------------------------------------------------------------

@router.get(
    "/{dataset_id}/fetch",
    response_model=PayloadResponse,
    summary="データセット本体を取得する",
)
def get_dataset_fetch(
    request: Request,
    dataset_id: str,
    user_id: str | None = Depends(get_current_user_optional),
    store: CredentialStore = Depends(get_credential_store),
) -> PayloadResponse:
    """指定データセットを上流 API から取得する。

    Raises:
        HTTPException 422: dataset_id フォーマット不正
        HTTPException 401: APIキー未設定
        HTTPException 404: データセットが存在しない
        HTTPException 429: レート制限
        HTTPException 504: タイムアウト
    """
    if not _DATASET_ID_PATTERN.match(dataset_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"dataset_id のフォーマットが不正です: '{dataset_id}'。"
                "'{source_id}:{original_id}' の形式で指定してください。"
            ),
        )

    source_id = dataset_id.split(":")[0]
    api_key = store.get(user_id, source_id)

    payload = fetch_dataset(dataset_id, source_id, api_key)
    _log_access(request, dataset_id=dataset_id, source_id=source_id, x_source="upstream")
    return _build_payload_response(payload)


def fetch_dataset(
    dataset_id: str,
    source_id: str,
    api_key: str | None,
) -> DatasetPayload:
    """データセットを取得する。テストからモック可能な独立関数。

    Raises:
        AuthenticationError: APIキー未設定
        DatasetNotFoundError: データセットが存在しない
        UpstreamTimeoutError: タイムアウト
        UpstreamRateLimitError: レート制限
        HTTPException 404: 未知のソース
    """
    connector = _get_connector_by_source_id(source_id)
    if connector is None:
        raise DatasetNotFoundError(f"不明なデータソース: '{source_id}'")

    connector.initialize(api_key)
    return connector.fetch(dataset_id, api_key)


# ---------------------------------------------------------------------------
# プライベートヘルパー
# ---------------------------------------------------------------------------

def _build_connectors(
    source: str | None,
    store: CredentialStore,
    user_id: str | None = None,
) -> list[DataSourceConnector]:
    """使用するコネクターのリストを構築する。"""
    factories = (
        {source: _CONNECTOR_FACTORIES[source]}
        if source is not None and source in _CONNECTOR_FACTORIES
        else _CONNECTOR_FACTORIES
    )

    connectors = []
    for source_id, factory in factories.items():
        connector = factory()
        connector.initialize(store.get(user_id, source_id))
        connectors.append(connector)

    return connectors


def _get_connector_by_source_id(source_id: str) -> DataSourceConnector | None:
    """source_id からコネクターを生成して返す。未知の場合は None。"""
    factory = _CONNECTOR_FACTORIES.get(source_id)
    if factory is None:
        return None
    return factory()


def _build_search_response(
    result: SearchResult,
    limit: int,
    offset: int,
) -> SearchResponse:
    """SearchResult を SearchResponse に変換する。"""
    items = [_metadata_to_schema(m) for m in result.items]
    return SearchResponse(
        items=items,
        total=result.total_count,
        has_next=result.has_next,
        limit=limit,
        offset=offset,
    )


def _build_payload_response(payload: DatasetPayload) -> PayloadResponse:
    """DatasetPayload を PayloadResponse に変換する。

    バイナリフォーマット（shapefile, binary）は base64 エンコードして返す。
    テキストフォーマットは UTF-8 デコードして返す。
    """
    if isinstance(payload.data, bytes):
        if payload.format in _BINARY_FORMATS:
            data_str = base64.b64encode(payload.data).decode("ascii")
            data_encoding: Literal["utf-8", "base64"] = "base64"
        else:
            data_str = payload.data.decode("utf-8", errors="replace")
            data_encoding = "utf-8"
    else:
        data_str = payload.data
        data_encoding = "utf-8"

    return PayloadResponse(
        metadata=_metadata_to_schema(payload.metadata),
        format=payload.format,
        fetched_at=payload.fetched_at,
        record_count=payload.record_count,
        data_encoding=data_encoding,
        data=data_str,
    )


def _metadata_to_schema(metadata: DatasetMetadata) -> MetadataSchema:
    """DatasetMetadata を MetadataSchema に変換する。"""
    return MetadataSchema(
        id=metadata.id,
        source_id=metadata.source_id,
        title=metadata.title,
        description=metadata.description,
        url=metadata.url,
        tags=list(metadata.tags),
        updated_at=metadata.updated_at,
    )


def _log_access(
    request: Request,
    query: str = "",
    source_id: str = "",
    dataset_id: str = "",
    x_source: str = "",
) -> None:
    """構造化アクセスログを JSON 形式で出力する。

    ログフィールド: timestamp, query, source_id, dataset_id, x_source, user_agent
    """
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "query": query,
        "source_id": source_id,
        "dataset_id": dataset_id,
        "x_source": x_source,
        "user_agent": request.headers.get("user-agent", ""),
    }
    logger.info(json.dumps(log_entry, ensure_ascii=False))


# ---------------------------------------------------------------------------
# 例外ハンドラー（main.py で登録）
# ---------------------------------------------------------------------------

def handle_authentication_error(request: Request, exc: AuthenticationError):
    """AuthenticationError → 401 HTTP レスポンス。"""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": str(exc)},
    )


def handle_not_found_error(request: Request, exc: DatasetNotFoundError):
    """DatasetNotFoundError → 404 HTTP レスポンス。"""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc)},
    )


def handle_timeout_error(request: Request, exc: UpstreamTimeoutError):
    """UpstreamTimeoutError → 504 HTTP レスポンス。"""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        content={"detail": str(exc)},
    )


def handle_rate_limit_error(request: Request, exc: UpstreamRateLimitError):
    """UpstreamRateLimitError → 429 HTTP レスポンス。"""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": str(exc)},
        headers={"Retry-After": str(int(_MAX_BACKOFF_SECONDS))},
    )
