"""
data.go.jp コネクターのユニットテスト

テスト対象の振る舞い:
- initialize: APIキーなしで動作する（無認証ソース）
- search: CKAN API レスポンスを DatasetMetadata に変換する
- search: limit/offset が正しく渡される
- search: API エラー時に適切な例外を発生させる
- fetch: データを取得して DatasetPayload に変換する
- fetch: タイムアウト時は UpstreamTimeoutError
"""

import json
from pathlib import Path

import httpx
import pytest
import respx

from connectors.datagojp import DataGoJpConnector
from core.errors import UpstreamRateLimitError, UpstreamTimeoutError
from core.models import DatasetMetadata, DatasetPayload

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture(filename: str) -> dict:
    """フィクスチャ JSON を読み込む。"""
    with (FIXTURES_DIR / filename).open(encoding="utf-8") as f:
        return json.load(f)


class TestDataGoJpConnectorSearch:
    """DataGoJpConnector.search() のテスト。"""

    def test_APIキーなしで初期化できる(self):
        """data.go.jp は無認証なので api_key=None で initialize できる。"""
        connector = DataGoJpConnector()
        connector.initialize(None)  # 例外が発生しないこと
        assert connector.source_id == "datagojp"

    def test_source_idが正しい(self):
        """source_id は 'datagojp' である。"""
        connector = DataGoJpConnector()
        assert connector.source_id == "datagojp"

    @respx.mock
    def test_検索結果をDatasetMetadataに変換する(self):
        """CKAN API レスポンスを DatasetMetadata のリストに変換する。"""
        fixture = load_fixture("datagojp_search_response.json")
        respx.get("https://www.data.go.jp/api/3/action/package_search").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        results = connector.search("人口", {"limit": 5, "offset": 0})

        assert len(results) > 0
        assert all(isinstance(r, DatasetMetadata) for r in results)
        assert all(r.source_id == "datagojp" for r in results)
        assert all(r.id.startswith("datagojp:") for r in results)

    @respx.mock
    def test_limitとoffsetがrowsとstartに変換される(self):
        """CKAN では limit=rows, offset=start として送信される。"""
        fixture = load_fixture("datagojp_search_response.json")
        route = respx.get("https://www.data.go.jp/api/3/action/package_search").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        connector.search("人口", {"limit": 10, "offset": 20})

        request = route.calls[0].request
        url_str = str(request.url)
        assert "rows=10" in url_str
        assert "start=20" in url_str

    @respx.mock
    def test_タイムアウトでUpstreamTimeoutErrorを発生させる(self):
        """タイムアウト時に UpstreamTimeoutError を発生させる。"""
        respx.get("https://www.data.go.jp/api/3/action/package_search").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.search("人口", {})

    @respx.mock
    def test_レート制限でUpstreamRateLimitErrorを発生させる(self):
        """429 を受信した場合 UpstreamRateLimitError を発生させる。"""
        respx.get("https://www.data.go.jp/api/3/action/package_search").mock(
            return_value=httpx.Response(429)
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamRateLimitError):
            connector.search("人口", {})

    @respx.mock
    def test_検索結果ゼロ件で空リストを返す(self):
        """ヒットなしのレスポンスで空リストを返す。"""
        empty_fixture = {
            "success": True,
            "result": {"count": 0, "results": []},
        }
        respx.get("https://www.data.go.jp/api/3/action/package_search").mock(
            return_value=httpx.Response(200, json=empty_fixture)
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        results = connector.search("存在しない検索語", {})
        assert results == []


class TestDataGoJpConnectorFetch:
    """DataGoJpConnector.fetch() のテスト。"""

    @respx.mock
    def test_データ取得でDatasetPayloadを返す(self):
        """fetch は DatasetPayload を返す。"""
        fixture = load_fixture("datagojp_fetch_response.json")
        respx.get("https://www.data.go.jp/api/3/action/package_show").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        payload = connector.fetch("datagojp:test-dataset-id", None)

        assert isinstance(payload, DatasetPayload)
        assert payload.metadata.source_id == "datagojp"

    @respx.mock
    def test_タイムアウトでUpstreamTimeoutErrorを発生させる(self):
        """fetch のタイムアウト時に UpstreamTimeoutError を発生させる。"""
        respx.get("https://www.data.go.jp/api/3/action/package_show").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.fetch("datagojp:test-dataset-id", None)

    @respx.mock
    def test_レート制限でUpstreamRateLimitErrorを発生させる(self):
        """429 を受信した場合 UpstreamRateLimitError を発生させる。"""
        respx.get("https://www.data.go.jp/api/3/action/package_show").mock(
            return_value=httpx.Response(429)
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamRateLimitError):
            connector.fetch("datagojp:test-dataset-id", None)
