"""
JMA コネクター（メタデータカタログ方式）のユニットテスト

テスト対象:
- search(): カタログ内キーワードマッチ
- fetch(): 実エンドポイント呼び出し
- エラーハンドリング
"""

import httpx
import pytest
import respx

from connectors.jma import JmaConnector
from core.errors import UpstreamRateLimitError, UpstreamTimeoutError


class TestJmaConnectorSearch:
    """search() のテスト。"""

    def test_source_idが正しい(self):
        connector = JmaConnector()
        assert connector.source_id == "jma"

    def test_APIキーなしで初期化できる(self):
        connector = JmaConnector()
        connector.initialize(None)

    def test_東京で検索すると天気予報と警報がヒットする(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("東京", {})

        assert result.total_count >= 2
        titles = [item.title for item in result.items]
        assert any("東京" in t for t in titles)

    def test_天気で検索すると予報エントリがヒットする(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("天気", {})

        assert result.total_count >= 50  # 58 地域の天気予報
        assert all(item.source_id == "jma" for item in result.items)

    def test_地震で検索すると地震情報がヒットする(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("地震", {})

        assert result.total_count >= 1
        assert any("地震" in item.title for item in result.items)

    def test_存在しないキーワードで空結果を返す(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("xyznotexist", {})

        assert result.total_count == 0
        assert len(result.items) == 0
        assert result.has_next is False

    def test_limitとoffsetが正しく適用される(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("天気", {"limit": 5, "offset": 0})

        assert len(result.items) == 5
        assert result.has_next is True

    def test_offsetで次ページを取得できる(self):
        connector = JmaConnector()
        connector.initialize(None)
        page1 = connector.search("天気", {"limit": 5, "offset": 0})
        page2 = connector.search("天気", {"limit": 5, "offset": 5})

        assert page1.items[0].id != page2.items[0].id

    def test_複数キーワードでAND検索になる(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("東京 天気", {})

        assert result.total_count >= 1
        assert all("東京" in item.title for item in result.items)
        assert all("天気" in item.title for item in result.items)

    def test_検索結果のidがjmaプレフィックスを持つ(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("天気", {"limit": 3})

        assert all(item.id.startswith("jma:") for item in result.items)

    def test_検索結果のurlが気象庁を指す(self):
        connector = JmaConnector()
        connector.initialize(None)
        result = connector.search("天気", {"limit": 1})

        assert result.items[0].url.startswith("https://www.jma.go.jp/")


class TestJmaConnectorFetch:
    """fetch() のテスト。"""

    @respx.mock
    def test_天気予報を取得できる(self):
        mock_forecast = {
            "publishingOffice": "気象庁",
            "reportDatetime": "2026-04-03T16:39:00+09:00",
            "targetArea": "東京都",
            "headlineText": "",
            "text": "晴れ",
        }
        respx.get("https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json").mock(
            return_value=httpx.Response(200, json=mock_forecast)
        )
        connector = JmaConnector()
        connector.initialize(None)
        payload = connector.fetch("jma:forecast:130000", None)

        assert payload.metadata.title == "東京都 天気予報"
        assert payload.format == "json"

    @respx.mock
    def test_地震情報を取得できる(self):
        mock_quake = [{"eid": "20260403", "ttl": "テスト地震", "mag": "4.0"}]
        respx.get("https://www.jma.go.jp/bosai/quake/data/list.json").mock(
            return_value=httpx.Response(200, json=mock_quake)
        )
        connector = JmaConnector()
        connector.initialize(None)
        payload = connector.fetch("jma:quake:latest", None)

        assert payload.metadata.title == "最新の地震情報"
        assert payload.format == "json"

    @respx.mock
    def test_タイムアウトでUpstreamTimeoutErrorを発生させる(self):
        respx.get("https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        connector = JmaConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.fetch("jma:forecast:130000", None)

    @respx.mock
    def test_サーバーエラーでUpstreamTimeoutErrorを発生させる(self):
        respx.get("https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json").mock(
            return_value=httpx.Response(500)
        )
        connector = JmaConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.fetch("jma:forecast:130000", None)

    @respx.mock
    def test_レート制限でUpstreamRateLimitErrorを発生させる(self):
        respx.get("https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json").mock(
            return_value=httpx.Response(429)
        )
        connector = JmaConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamRateLimitError):
            connector.fetch("jma:forecast:130000", None)

    def test_存在しないdataset_idでエラーを発生させる(self):
        connector = JmaConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError, match="データセットが見つかりません"):
            connector.fetch("jma:nonexistent:000000", None)
