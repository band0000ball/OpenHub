"""S3 書き込みモジュール。DatasetMetadata を JSON として S3 に保存する。"""

import json
from dataclasses import asdict
from datetime import datetime, timezone

import boto3

from core.models import DatasetMetadata


def _serialize_items(items: tuple[DatasetMetadata, ...]) -> list[dict]:
    """DatasetMetadata のタプルを JSON シリアライズ可能な list[dict] に変換する。"""
    result = []
    for item in items:
        d = asdict(item)
        # frozen dataclass の tags は tuple なので list に変換
        d["tags"] = list(d["tags"])
        result.append(d)
    return result


def write_source_json(
    bucket: str,
    source_id: str,
    items: tuple[DatasetMetadata, ...],
    s3_client=None,
) -> None:
    """ソース別メタデータ JSON を S3 に書き込む。

    キー: catalog/sources/{source_id}.json
    """
    client = s3_client or boto3.client("s3")
    body = json.dumps(
        {"source_id": source_id, "count": len(items), "items": _serialize_items(items)},
        ensure_ascii=False,
    )
    client.put_object(
        Bucket=bucket,
        Key=f"catalog/sources/{source_id}.json",
        Body=body.encode("utf-8"),
        ContentType="application/json",
    )


def write_metadata_json(
    bucket: str,
    all_items: tuple[DatasetMetadata, ...],
    s3_client=None,
) -> None:
    """統合メタデータ JSON を S3 に書き込む。

    キー: catalog/metadata.json
    """
    client = s3_client or boto3.client("s3")
    body = json.dumps(
        {"count": len(all_items), "items": _serialize_items(all_items)},
        ensure_ascii=False,
    )
    client.put_object(
        Bucket=bucket,
        Key="catalog/metadata.json",
        Body=body.encode("utf-8"),
        ContentType="application/json",
    )


def write_last_updated(bucket: str, s3_client=None) -> str:
    """最終更新タイムスタンプを S3 に書き込む。

    キー: catalog/last_updated.json
    Returns: ISO 8601 形式のタイムスタンプ
    """
    client = s3_client or boto3.client("s3")
    timestamp = datetime.now(timezone.utc).isoformat()
    body = json.dumps({"last_updated": timestamp})
    client.put_object(
        Bucket=bucket,
        Key="catalog/last_updated.json",
        Body=body.encode("utf-8"),
        ContentType="application/json",
    )
    return timestamp
