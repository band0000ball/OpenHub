"""S3 Writer のテスト。moto で S3 をモック。"""

import json
import os

import boto3
import pytest
from moto import mock_aws

from collector.config import CollectorConfig
from collector.s3_writer import (
    write_last_updated,
    write_metadata_json,
    write_source_json,
)
from core.models import DatasetMetadata

BUCKET = "test-openhub-cache"


@pytest.fixture
def sample_items() -> tuple[DatasetMetadata, ...]:
    return (
        DatasetMetadata(
            id="estat:0001",
            source_id="estat",
            title="人口統計データ",
            description="日本の人口統計",
            url="https://example.com/1",
            tags=("人口", "統計"),
            updated_at="2024-01-01T00:00:00Z",
        ),
        DatasetMetadata(
            id="estat:0002",
            source_id="estat",
            title="経済指標",
            description="GDP等の経済指標",
            url="https://example.com/2",
            tags=("経済",),
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


class TestWriteSourceJson:
    def test_writes_correct_key_and_content(self, s3_client, sample_items):
        write_source_json(BUCKET, "estat", sample_items, s3_client=s3_client)

        obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/sources/estat.json")
        data = json.loads(obj["Body"].read())

        assert data["source_id"] == "estat"
        assert data["count"] == 2
        assert len(data["items"]) == 2
        assert data["items"][0]["title"] == "人口統計データ"
        assert data["items"][0]["tags"] == ["人口", "統計"]

    def test_writes_empty_items(self, s3_client):
        write_source_json(BUCKET, "datagojp", (), s3_client=s3_client)

        obj = s3_client.get_object(
            Bucket=BUCKET, Key="catalog/sources/datagojp.json"
        )
        data = json.loads(obj["Body"].read())

        assert data["count"] == 0
        assert data["items"] == []


class TestWriteMetadataJson:
    def test_writes_unified_metadata(self, s3_client, sample_items):
        write_metadata_json(BUCKET, sample_items, s3_client=s3_client)

        obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json")
        data = json.loads(obj["Body"].read())

        assert data["count"] == 2
        assert len(data["items"]) == 2

    def test_writes_empty_metadata(self, s3_client):
        write_metadata_json(BUCKET, (), s3_client=s3_client)

        obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/metadata.json")
        data = json.loads(obj["Body"].read())

        assert data["count"] == 0


class TestWriteLastUpdated:
    def test_writes_timestamp(self, s3_client):
        ts = write_last_updated(BUCKET, s3_client=s3_client)

        obj = s3_client.get_object(Bucket=BUCKET, Key="catalog/last_updated.json")
        data = json.loads(obj["Body"].read())

        assert data["last_updated"] == ts
        assert "T" in ts  # ISO 8601 format


class TestCollectorConfig:
    def test_from_env(self, monkeypatch):
        monkeypatch.setenv("CACHE_BUCKET_NAME", "my-bucket")
        monkeypatch.setenv("COLLECTOR_SOURCES", "estat,datagojp")

        config = CollectorConfig.from_env()

        assert config.bucket_name == "my-bucket"
        assert config.source_ids == ("estat", "datagojp")

    def test_from_env_default_sources(self, monkeypatch):
        monkeypatch.setenv("CACHE_BUCKET_NAME", "my-bucket")
        monkeypatch.delenv("COLLECTOR_SOURCES", raising=False)

        config = CollectorConfig.from_env()

        assert config.source_ids == ("estat", "datagojp", "egov_law", "jma")

    def test_from_env_missing_bucket_raises(self, monkeypatch):
        monkeypatch.delenv("CACHE_BUCKET_NAME", raising=False)

        with pytest.raises(ValueError, match="CACHE_BUCKET_NAME"):
            CollectorConfig.from_env()
