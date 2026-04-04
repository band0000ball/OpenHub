"""
S3 キャッシュ読み取りエンドポイント

GET /cache/metadata     — 統合メタデータ JSON を返す
GET /cache/last_updated — 最終更新タイムスタンプを返す
"""

import json
import logging
import os

import boto3
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/cache", tags=["キャッシュ"])

logger = logging.getLogger(__name__)

_BUCKET_NAME = os.environ.get("CACHE_BUCKET_NAME", "openhub-cache")


def _get_s3_json(key: str) -> dict:
    """S3 から JSON を読み取って dict で返す。"""
    client = boto3.client("s3")
    response = client.get_object(Bucket=_BUCKET_NAME, Key=key)
    body = response["Body"].read().decode("utf-8")
    return json.loads(body)


@router.get("/metadata", summary="キャッシュ済みメタデータを返す")
def get_cached_metadata(source: str | None = None):
    """S3 のメタデータ JSON を返す。

    source パラメータでソース別 JSON を取得可能（レスポンスサイズ制限対策）。
    source 省略時は全ソースを順次読み取って統合する。
    """
    try:
        if source:
            return _get_s3_json(f"catalog/sources/{source}.json")

        # 全ソースを個別に読み取って統合（metadata.json は 6MB 超の場合があるため）
        all_items: list[dict] = []
        for source_id in ("estat", "datagojp", "egov_law", "jma"):
            try:
                data = _get_s3_json(f"catalog/sources/{source_id}.json")
                all_items.extend(data.get("items", []))
            except Exception as exc:
                logger.warning("Failed to read source %s: %s", source_id, exc)
                continue

        return {"count": len(all_items), "items": all_items}
    except Exception as exc:
        logger.error("Failed to read S3 cache: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cache read failed: {exc}",
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
