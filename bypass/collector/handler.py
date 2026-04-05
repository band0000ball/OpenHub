"""Collector Lambda ハンドラー。

既存コネクターの search() を呼び出してメタデータを収集し、S3 に書き込む。
ソースごとに収集戦略が異なる:
- 汎用ソース: 空クエリで全件取得
- e-Gov 法令: キーワード検索のみ対応のため、代表キーワードで複数回検索して統合
"""

import logging
import os
from dataclasses import dataclass, field

from collector.config import CollectorConfig
from collector.s3_writer import write_last_updated, write_metadata_json, write_source_json
from core.connector import DataSourceConnector
from core.models import DatasetMetadata

logger = logging.getLogger(__name__)

# e-Gov 法令 API は全件取得ができないため、代表的な法令カテゴリで検索する
_EGOV_LAW_KEYWORDS: tuple[str, ...] = (
    "憲法", "民法", "刑法", "商法", "行政",
    "労働", "税", "教育", "環境", "医療",
    "建築", "道路", "食品", "金融", "通信",
    "個人情報", "著作権", "会社", "保険", "年金",
)

# CiNii Research は空クエリ非対応のため、学術分野キーワードで検索する
_CINII_KEYWORDS: tuple[str, ...] = (
    "情報", "医学", "工学", "経済", "教育",
    "環境", "物理", "化学", "生物", "法学",
    "社会", "心理", "数学", "農学", "建築",
    "機械学習", "エネルギー", "ロボット", "材料", "宇宙",
)

# BOJ 日銀統計は DB ID 別にメタデータを取得する
_BOJ_DB_IDS: tuple[str, ...] = (
    "FM08",  # 為替
    "IR01",  # 金利
    "MD10",  # マネーストック
    "BP01",  # 国際収支
    "CO",    # 企業物価
    "ST",    # 短観
    "FC01",  # 資金循環
    "QE",    # 四半期別GDP
)


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


_PAGE_SIZE = 1000
_MAX_ITEMS = 10000


def _collect_default(connector: DataSourceConnector) -> tuple[DatasetMetadata, ...]:
    """汎用収集: 空クエリでページネーションしながら全件取得する。"""
    all_items: list[DatasetMetadata] = []
    offset = 0

    while offset < _MAX_ITEMS:
        result = connector.search("", {"limit": _PAGE_SIZE, "offset": offset})
        all_items.extend(result.items)

        if not result.has_next or len(result.items) == 0:
            break
        offset += len(result.items)
        logger.info("  ... %d items so far (offset=%d)", len(all_items), offset)

    return tuple(all_items)


def _collect_egov_law(connector: DataSourceConnector) -> tuple[DatasetMetadata, ...]:
    """e-Gov 法令収集: 代表キーワードで複数回検索し、重複を除去して統合する。"""
    seen: set[str] = set()
    items: list[DatasetMetadata] = []

    for keyword in _EGOV_LAW_KEYWORDS:
        try:
            result = connector.search(keyword, {"limit": 100, "offset": 0})
            for item in result.items:
                if item.id not in seen:
                    seen.add(item.id)
                    items.append(item)
        except Exception as exc:
            logger.warning("e-Gov law keyword '%s' failed: %s", keyword, exc)
            continue

    return tuple(items)


def _collect_cinii(connector: DataSourceConnector) -> tuple[DatasetMetadata, ...]:
    """CiNii Research 収集: 学術分野キーワードで検索し、重複を除去して統合する。"""
    seen: set[str] = set()
    items: list[DatasetMetadata] = []

    for keyword in _CINII_KEYWORDS:
        try:
            result = connector.search(keyword, {"limit": 200, "offset": 0})
            for item in result.items:
                if item.id not in seen:
                    seen.add(item.id)
                    items.append(item)
        except Exception as exc:
            logger.warning("CiNii keyword '%s' failed: %s", keyword, exc)
            continue

    return tuple(items)


def _collect_boj(connector: DataSourceConnector, deadline: float = 0) -> tuple[DatasetMetadata, ...]:
    """BOJ 日銀統計収集: DB ID 別にメタデータを取得して統合する。"""
    seen: set[str] = set()
    items: list[DatasetMetadata] = []

    for db_id in _BOJ_DB_IDS:
        if deadline and time.monotonic() > deadline:
            logger.warning("  BOJ deadline reached at %d items, stopping", len(items))
            break

        try:
            result = connector.search("", {"db": db_id})
            for item in result.items:
                if item.id not in seen:
                    seen.add(item.id)
                    items.append(item)
            logger.info("  BOJ db=%s: %d unique items so far", db_id, len(items))
        except Exception as exc:
            logger.warning("BOJ db '%s' failed: %s", db_id, exc)
            continue

    return tuple(items)


# ソース ID → 収集関数のマッピング
_COLLECT_STRATEGIES: dict[str, callable] = {
    "egov_law": _collect_egov_law,
    "cinii": _collect_cinii,
    "boj": _collect_boj,
}


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
            api_key = os.environ.get(f"{source_id.upper()}_API_KEY")
            connector.initialize(api_key)

            strategy = _COLLECT_STRATEGIES.get(source_id, _collect_default)
            items = strategy(connector)

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
