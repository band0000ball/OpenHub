"""Collector 設定モジュール。環境変数からバケット名・対象ソースを読み取る。"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class CollectorConfig:
    """Collector Lambda の設定。frozen=True でイミュータブル。"""

    bucket_name: str
    source_ids: tuple[str, ...]

    @staticmethod
    def from_env() -> "CollectorConfig":
        """環境変数から設定を読み取る。

        CACHE_BUCKET_NAME: S3 バケット名（必須）
        COLLECTOR_SOURCES: カンマ区切りのソース ID（省略時は全ソース）
        """
        bucket_name = os.environ.get("CACHE_BUCKET_NAME", "")
        if not bucket_name:
            raise ValueError("CACHE_BUCKET_NAME environment variable is required")

        sources_str = os.environ.get("COLLECTOR_SOURCES", "estat,datagojp,egov_law,jma")
        source_ids = tuple(s.strip() for s in sources_str.split(",") if s.strip())

        return CollectorConfig(bucket_name=bucket_name, source_ids=source_ids)
