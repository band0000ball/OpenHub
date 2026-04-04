"""Collector Lambda ハンドラー。

既存コネクターの search() を呼び出してメタデータを収集し、S3 に書き込む。
"""

import logging
import os
from dataclasses import dataclass, field

from collector.config import CollectorConfig
from collector.s3_writer import write_last_updated, write_metadata_json, write_source_json
from core.models import DatasetMetadata

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CollectResult:
    """収集結果。各ソースの件数とエラーを記録する。"""

    source_counts: dict[str, int] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)

    @property
    def total_count(self) -> int:
        return sum(self.source_counts.values())


def _get_connector_factories() -> dict[str, type]:
    """ソース ID → コネクターファクトリのマッピングを返す。

    テストではモックに差し替え可能。
    """
    from api.datasets import _CONNECTOR_FACTORIES
    return dict(_CONNECTOR_FACTORIES)


def collect_all(config: CollectorConfig, s3_client=None) -> CollectResult:
    """全ソースからメタデータを収集し S3 に書き込む。

    各ソースは独立して処理され、1 つが失敗しても他のソースの収集は継続する。
    """
    factories = _get_connector_factories()
    all_items: list[DatasetMetadata] = []
    source_counts: dict[str, int] = {}
    errors: dict[str, str] = {}

    for source_id in config.source_ids:
        factory = factories.get(source_id)
        if factory is None:
            errors[source_id] = f"Unknown source: {source_id}"
            logger.warning("Unknown source_id: %s", source_id)
            continue

        try:
            connector = factory()
            # API キーが必要なソースは環境変数から取得
            api_key = os.environ.get(f"{source_id.upper()}_API_KEY")
            connector.initialize(api_key)

            result = connector.search("", {"limit": 1000, "offset": 0})
            items = result.items

            write_source_json(config.bucket_name, source_id, items, s3_client=s3_client)
            all_items.extend(items)
            source_counts[source_id] = len(items)
            logger.info("Collected %d items from %s", len(items), source_id)

        except Exception as exc:
            errors[source_id] = str(exc)
            logger.error("Failed to collect from %s: %s", source_id, exc)

    write_metadata_json(config.bucket_name, tuple(all_items), s3_client=s3_client)
    write_last_updated(config.bucket_name, s3_client=s3_client)

    return CollectResult(source_counts=source_counts, errors=errors)


def handler(event, context):
    """Lambda エントリポイント。EventBridge から呼び出される。"""
    config = CollectorConfig.from_env()
    result = collect_all(config)

    response = {
        "statusCode": 200,
        "body": {
            "total_count": result.total_count,
            "source_counts": result.source_counts,
            "errors": result.errors,
        },
    }
    logger.info("Collector completed: %s", response["body"])
    return response
