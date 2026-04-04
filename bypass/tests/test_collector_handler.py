"""Collector Handler のテスト。コネクター・S3 をモック。"""

import gzip
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
        metadata_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json.gz")
        metadata = json.loads(gzip.decompress(metadata_obj["Body"].read()))
        assert metadata["count"] == 2

        estat_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/sources/estat.json.gz")
        estat_data = json.loads(gzip.decompress(estat_obj["Body"].read()))
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
        metadata_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json.gz")
        metadata = json.loads(gzip.decompress(metadata_obj["Body"].read()))
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
        metadata_obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json.gz")
        metadata = json.loads(gzip.decompress(metadata_obj["Body"].read()))
        assert metadata["count"] == 0

    def test_unknown_source_id_skipped(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("unknown_source",))

        with patch("collector.handler._get_connector_factories", return_value={}):
            result = collect_all(config, s3_client=s3_client)

        assert result.source_counts == {}
        assert "unknown_source" in result.errors


class TestDefaultPagination:
    def test_paginates_until_has_next_false(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("datagojp",))

        page1 = tuple(
            DatasetMetadata(
                id=f"datagojp:{i}", source_id="datagojp", title=f"Data {i}",
                description="", url="https://example.com", tags=(), updated_at="2024-01-01",
            )
            for i in range(3)
        )
        page2 = tuple(
            DatasetMetadata(
                id=f"datagojp:{i}", source_id="datagojp", title=f"Data {i}",
                description="", url="https://example.com", tags=(), updated_at="2024-01-01",
            )
            for i in range(3, 5)
        )

        mock_conn = MagicMock()
        mock_conn.source_id = "datagojp"
        mock_conn.search.side_effect = [
            SearchResult(items=page1, total_count=5, has_next=True),
            SearchResult(items=page2, total_count=5, has_next=False),
        ]

        connector_map = {"datagojp": lambda: mock_conn}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        assert result.source_counts == {"datagojp": 5}
        assert mock_conn.search.call_count == 2
        # offset が正しく渡されているか
        assert mock_conn.search.call_args_list[1][0][1]["offset"] == 3

    def test_stops_on_empty_page(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("datagojp",))

        mock_conn = MagicMock()
        mock_conn.source_id = "datagojp"
        mock_conn.search.return_value = SearchResult(
            items=(), total_count=0, has_next=False,
        )

        connector_map = {"datagojp": lambda: mock_conn}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        assert result.source_counts == {"datagojp": 0}
        assert mock_conn.search.call_count == 1


class TestEgovLawStrategy:
    def test_collects_via_multiple_keywords(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("egov_law",))

        items_a = (
            DatasetMetadata(
                id="egov_law:law1", source_id="egov_law", title="民法",
                description="民法第一条", url="https://example.com/1",
                tags=("法律",), updated_at="2024-01-01T00:00:00Z",
            ),
        )
        items_b = (
            DatasetMetadata(
                id="egov_law:law2", source_id="egov_law", title="刑法",
                description="刑法第一条", url="https://example.com/2",
                tags=("法律",), updated_at="2024-01-01T00:00:00Z",
            ),
        )

        mock_egov = MagicMock()
        mock_egov.source_id = "egov_law"
        # 各キーワードで異なる結果を返す（最初の2回だけ、残りは空）
        mock_egov.search.side_effect = [
            SearchResult(items=items_a, total_count=1, has_next=False),
            SearchResult(items=items_b, total_count=1, has_next=False),
        ] + [SearchResult(items=(), total_count=0, has_next=False)] * 18

        connector_map = {"egov_law": lambda: mock_egov}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        assert result.source_counts == {"egov_law": 2}
        # 20 キーワード分呼ばれる
        assert mock_egov.search.call_count == 20

    def test_deduplicates_across_keywords(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("egov_law",))

        same_item = (
            DatasetMetadata(
                id="egov_law:law1", source_id="egov_law", title="民法",
                description="民法", url="https://example.com/1",
                tags=(), updated_at="2024-01-01T00:00:00Z",
            ),
        )

        mock_egov = MagicMock()
        mock_egov.source_id = "egov_law"
        # 全キーワードで同じ法令が返る
        mock_egov.search.return_value = SearchResult(
            items=same_item, total_count=1, has_next=False,
        )

        connector_map = {"egov_law": lambda: mock_egov}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        # 重複除去で 1 件のみ
        assert result.source_counts == {"egov_law": 1}

    def test_partial_keyword_failure_continues(self, s3_client):
        config = CollectorConfig(bucket_name=BUCKET, source_ids=("egov_law",))

        item = (
            DatasetMetadata(
                id="egov_law:law1", source_id="egov_law", title="憲法",
                description="", url="https://example.com/1",
                tags=(), updated_at="2024-01-01T00:00:00Z",
            ),
        )

        mock_egov = MagicMock()
        mock_egov.source_id = "egov_law"
        # 最初のキーワードは成功、残りは全て失敗
        mock_egov.search.side_effect = [
            SearchResult(items=item, total_count=1, has_next=False),
        ] + [Exception("API error")] * 19

        connector_map = {"egov_law": lambda: mock_egov}

        with patch("collector.handler._get_connector_factories", return_value=connector_map):
            result = collect_all(config, s3_client=s3_client)

        # 成功した 1 件は収集される
        assert result.source_counts == {"egov_law": 1}
        assert "egov_law" not in result.errors
