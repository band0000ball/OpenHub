"""
S3 キャッシュ読み取りエンドポイント

GET /cache/metadata     — メタデータ検索（S3 から読み取り → フィルタ → 返却）
GET /cache/last_updated — 最終更新タイムスタンプを返す
"""

import gzip
import json
import logging
import os

import boto3
from fastapi import APIRouter, HTTPException, Query, status

router = APIRouter(prefix="/cache", tags=["キャッシュ"])

logger = logging.getLogger(__name__)

_BUCKET_NAME = os.environ.get("CACHE_BUCKET_NAME", "openhub-cache")

# ソース別 S3 データの in-memory キャッシュ（Lambda インスタンス内で再利用）
_source_cache: dict[str, list[dict]] = {}


def _get_s3_json(key: str) -> dict:
    """S3 から JSON を読み取って dict で返す。gzip 圧縮に対応。"""
    client = boto3.client("s3")
    response = client.get_object(Bucket=_BUCKET_NAME, Key=key)
    raw = response["Body"].read()

    # gzip 圧縮されている場合は解凍
    if key.endswith(".gz") or response.get("ContentEncoding") == "gzip":
        raw = gzip.decompress(raw)

    return json.loads(raw.decode("utf-8"))


def _get_source_items(source_id: str) -> list[dict]:
    """ソース別メタデータを取得する。Lambda 内キャッシュあり。"""
    if source_id in _source_cache:
        return _source_cache[source_id]

    try:
        data = _get_s3_json(f"catalog/sources/{source_id}.json.gz")
        items = data.get("items", [])
        _source_cache[source_id] = items
        return items
    except Exception as exc:
        logger.warning("Failed to read source %s: %s", source_id, exc)
        return []


def _get_all_items() -> list[dict]:
    """全ソースのメタデータを統合して返す。"""
    all_items: list[dict] = []
    for source_id in ("estat", "datagojp", "egov_law", "jma", "cinii", "boj", "jshis"):
        all_items.extend(_get_source_items(source_id))
    return all_items


def _search_items(
    items: list[dict],
    q: str,
    source: str | None,
    limit: int,
    offset: int,
) -> dict:
    """in-memory キーワード検索 + ページネーション。"""
    filtered = items

    if source:
        filtered = [i for i in filtered if i.get("source_id") == source]

    keywords = q.lower().split() if q.strip() else []
    if keywords:
        def matches(item: dict) -> bool:
            text = f"{item.get('title', '')} {item.get('description', '')} {' '.join(item.get('tags', []))}".lower()
            return all(kw in text for kw in keywords)
        filtered = [i for i in filtered if matches(i)]

    total = len(filtered)
    paged = filtered[offset:offset + limit]

    return {
        "items": paged,
        "total": total,
        "has_next": offset + limit < total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/metadata", summary="キャッシュ済みメタデータを検索する")
def get_cached_metadata(
    source: str | None = Query(None, description="ソース ID で絞り込み"),
    q: str = Query("", description="キーワード検索"),
    limit: int = Query(20, ge=1, le=1000, description="取得件数"),
    offset: int = Query(0, ge=0, description="オフセット"),
):
    """S3 のメタデータを検索して返す。サーバーサイドでフィルタリング。"""
    try:
        if source:
            items = _get_source_items(source)
        else:
            items = _get_all_items()

        return _search_items(items, q, source, limit, offset)
    except Exception as exc:
        logger.error("Failed to read S3 cache: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cache read failed: {exc}",
        ) from exc


@router.get("/browse", summary="ソース別ブラウズ（各ソースから N 件ずつ取得）")
def get_cached_browse(
    limit_per: int = Query(5, ge=1, le=50, description="ソース毎の件数"),
):
    """全ソースから limit_per 件ずつ取得してソース別に返す。"""
    try:
        source_ids = ("estat", "datagojp", "egov_law", "jma", "cinii", "boj")
        sections: list[dict] = []

        for source_id in source_ids:
            items = _get_source_items(source_id)
            sections.append({
                "source_id": source_id,
                "items": items[:limit_per],
                "total": len(items),
            })

        return {"sections": sections}
    except Exception as exc:
        logger.error("Failed to browse cache: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Browse failed: {exc}",
        ) from exc


@router.get("/last_updated", summary="キャッシュの最終更新日時を返す")
def get_cache_last_updated():
    """S3 の catalog/last_updated.json を返す。"""
    try:
        return _get_s3_json("catalog/last_updated.json")
    except Exception as exc:
        logger.error("Failed to read S3 last_updated: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cache read failed: {exc}",
        ) from exc
