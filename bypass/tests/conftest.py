"""
pytest 共有フィクスチャ

- 各テストファイルから import して使う
- TestClient, モックコネクター, サンプルメタデータ等を提供する
"""

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from api.datasets import _search_cache
from core.models import DatasetMetadata, DatasetPayload

# フィクスチャデータのディレクトリ
FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# キャッシュクリア（テスト間の干渉防止）
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_search_cache():
    """各テストの前後に検索キャッシュをクリアする。"""
    _search_cache.clear()
    yield
    _search_cache.clear()


# ---------------------------------------------------------------------------
# サンプルデータ
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_metadata() -> DatasetMetadata:
    """テスト用のサンプルメタデータ。"""
    return DatasetMetadata(
        id="estat:0003191203",
        source_id="estat",
        title="人口・世帯 人口推計",
        description="人口推計の結果を提供するデータセット",
        url="https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?statsDataId=0003191203",
        tags=("人口", "統計", "推計"),
        updated_at="2024-01-15T00:00:00+09:00",
    )


@pytest.fixture
def sample_payload(sample_metadata: DatasetMetadata) -> DatasetPayload:
    """テスト用のサンプルペイロード。"""
    return DatasetPayload(
        metadata=sample_metadata,
        data=b'{"GET_STATS_DATA": {"RESULT": {"STATUS": 0}}}',
        format="json",
        fetched_at="2024-01-15T10:00:00+09:00",
        record_count=100,
    )


# ---------------------------------------------------------------------------
# FastAPI テストクライアント
# ---------------------------------------------------------------------------

@pytest.fixture
def app():
    """テスト用 FastAPI アプリケーション。"""
    from main import create_app
    return create_app()


@pytest.fixture
def client(app) -> TestClient:
    """テスト用 HTTP クライアント（依存関係はオーバーライド済み）。"""
    return TestClient(app)


# ---------------------------------------------------------------------------
# フィクスチャ JSON ローダー
# ---------------------------------------------------------------------------

def load_fixture(filename: str) -> dict:
    """フィクスチャ JSON ファイルを読み込む。"""
    path = FIXTURES_DIR / filename
    with path.open(encoding="utf-8") as f:
        return json.load(f)
