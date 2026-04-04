"""Collector Handler のテスト。コネクター・S3 をモック。"""

import json
from unittest.mock import MagicMock, patch

import boto3
import pytest
from moto import mock_aws

from collector.config import CollectorConfig
from collector.handler import collect_all, CollectResult
from core.models import DatasetMetadata, SearchResult

BUCKET = "test-openhub-cache"


@pytest.fixture
def config() -> CollectorConfig:
    return CollectorConfig(bucket_name=BUCKET, source_ids=("estat", "datagojp"))


@pytest.fixture
def sample_estat_items() -> tuple[DatasetMetadata, ...]:
    return (
        DatasetMetadata(
            id="estat:0001",
            source_id="estat",
            title="人口統計",
            description="人口データ",
            url="https://example.com/1",
            tags=("人口",),
            updated_at="2024-01-01T00:00:00Z",
        ),
    )


@pytest.fixture
def sample_datagojp_items() -> tuple[DatasetMetadata, ...]:
    return (
        DatasetMetadata(
            id="datagojp:0001",
            source_id="datagojp",
            title="オープンデータ一覧",
            description="data.go.jp のデータ",
            url="https://example.com/2",
            tags=("オープンデータ",),
            updated_at="2024-02-01T00:00:00Z",
        ),
    )


@pytest.fixture
def s3_client():
    with mock_aws():
        client = boto3.client("s3", region_name="ap-northeast-1")
        client.create_bucket(
            Bucket=BUCKET,
            CreateBucketConfiguration={"LocationConstraint": "ap-northeast-1"},
        )
        yield client


class TestCollectAll:
    def test_collects_from_all_sources_and_writes_s3(
        self, config, s3_client, sample_estat_items, sample_datagojp_items
    ):
        mock_estat = MagicMock()
        mock_estat.source_id = "estat"
        mock_estat.search.return_value = SearchResult(
            items=sample_estat_items, total_count=1, has_next=False
        )

        mock_datagojp = MagicMock()
        mock_datagojp.source_id = "datagojp"
        mock_datagojp.search.return_value = SearchResult(
            items=sample_datagojp_items, total_count=1, has_next=False
        )

        connector_map = {"estat": lambda: mock_estat, "datagojp": lambda: mock_datagojp}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        assert isinstance(result, CollectResult)
        assert result.source_counts == {"estat": 1, "datagojp": 1}
        assert result.errors == {}
        assert result.total_count == 2

        # S3 にデータが書き込まれていることを確認
        metadata_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json")
        metadata = json.loads(metadata_obj["Body"].read())
        assert metadata["count"] == 2

        estat_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/sources/estat.json")
        estat_data = json.loads(estat_obj["Body"].read())
        assert estat_data["count"] == 1

        last_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/last_updated.json")
        last_data = json.loads(last_obj["Body"].read())
        assert "last_updated" in last_data

    def test_partial_failure_continues(self, config, s3_client, sample_datagojp_items):
        mock_estat = MagicMock()
        mock_estat.source_id = "estat"
        mock_estat.search.side_effect = Exception("API timeout")

        mock_datagojp = MagicMock()
        mock_datagojp.source_id = "datagojp"
        mock_datagojp.search.return_value = SearchResult(
            items=sample_datagojp_items, total_count=1, has_next=False
        )

        connector_map = {"estat": lambda: mock_estat, "datagojp": lambda: mock_datagojp}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        assert result.source_counts == {"datagojp": 1}
        assert "estat" in result.errors
        assert result.total_count == 1

        # 成功したソースのデータは書き込まれている
        metadata_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json")
        metadata = json.loads(metadata_obj["Body"].read())
        assert metadata["count"] == 1

    def test_all_sources_fail(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("estat",))

        mock_estat = MagicMock()
        mock_estat.source_id = "estat"
        mock_estat.search.side_effect = Exception("Network error")

        connector_map = {"estat": lambda: mock_estat}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        assert result.source_counts == {}
        assert "estat" in result.errors
        assert result.total_count == 0

        # 空のメタデータが書き込まれている
        metadata_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json")
        metadata = json.loads(metadata_obj["Body"].read())
        assert metadata["count"] == 0

    def test_unknown_source_id_skipped(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("unknown_source",))

        with patch("collector.handler._get_connector_factories", return_value={}):
            result = collect_all(config, s3_client=s3_client)

        assert result.source_counts == {}
        assert "unknown_source" in result.errors
