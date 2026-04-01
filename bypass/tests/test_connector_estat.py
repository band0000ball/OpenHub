"""
e-Stat コネクターのユニットテスト

テスト対象の振る舞い:
- initialize: APIキーを設定できる
- search: e-Stat API レスポンスを DatasetMetadata に変換する
- search: フィルタ（limit/offset）が正しく渡される
- search: APIキー未設定時は例外を発生させる
- search: API エラーレスポンス時は適切な例外を発生させる
- fetch: データを取得して DatasetPayload に変換する
- fetch: タイムアウト時は UpstreamTimeoutError を発生させる
- fetch: レート制限時は UpstreamRateLimitError を発生させる
"""

import json
from pathlib import Path
import httpx
import pytest
import respx

from connectors.estat import EStatConnector
from core.errors import (
    AuthenticationError,
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)
from core.models import DatasetMetadata, DatasetPayload, SearchResult

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture(filename: str) -> dict:
    """フィクスチャ JSON を読み込む。"""
    with (FIXTURES_DIR / filename).open(encoding="utf-8") as f:
        return json.load(f)


class TestEStatConnectorSearch:
    """EStatConnector.search() のテスト。"""

    def test_APIキーを設定できる(self):
        """initialize により APIキーが設定される。"""
        connector = EStatConnector()
        connector.initialize("test_api_key_123")
        assert connector._api_key == "test_api_key_123"

    def test_APIキー未設定時にAuthenticationErrorを発生させる(self):
        """APIキー未設定で search を呼ぶと AuthenticationError を発生させる。"""
        connector = EStatConnector()
        with pytest.raises(AuthenticationError):
            connector.search("人口", {})

    @respx.mock
    def test_検索結果をSearchResultに変換する(self):
        """API レスポンスを SearchResult に正しく変換する。"""
        fixture = load_fixture("estat_search_response.json")
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        result = connector.search("人口", {"limit": 5, "offset": 0})

        assert isinstance(result, SearchResult)
        assert len(result.items) > 0
        assert all(isinstance(r, DatasetMetadata) for r in result.items)
        assert all(r.source_id == "estat" for r in result.items)
        # ID フォーマット検証
        assert all(r.id.startswith("estat:") for r in result.items)

    @respx.mock
    def test_total_countがNUMBERから取得される(self):
        """DATALIST_INF.NUMBER が total_count に正しく設定される。"""
        fixture = load_fixture("estat_search_response.json")  # NUMBER=3
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        result = connector.search("人口", {"limit": 5, "offset": 0})

        assert result.total_count == 3

    @respx.mock
    def test_has_nextがFalseになる_全件取得済み(self):
        """offset + len(items) == total_count のとき has_next は False。"""
        fixture = load_fixture("estat_search_response.json")  # 3件取得、total=3
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        result = connector.search("人口", {"limit": 5, "offset": 0})

        assert result.has_next is False

    @respx.mock
    def test_has_nextがTrueになる_次ページあり(self):
        """offset + len(items) < total_count のとき has_next は True。"""
        fixture = load_fixture("estat_search_response.json")  # 3件取得、total=3
        # total_count を大きくするため NUMBER を上書き
        import copy
        fixture_with_more = copy.deepcopy(fixture)
        fixture_with_more["GET_STATS_LIST"]["DATALIST_INF"]["NUMBER"] = 10
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(200, json=fixture_with_more)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        result = connector.search("人口", {"limit": 3, "offset": 0})

        assert result.has_next is True

    @respx.mock
    def test_limitとoffsetがクエリパラメータに含まれる(self):
        """limit と offset が上流 API へのリクエストに正しく渡される。"""
        fixture = load_fixture("estat_search_response.json")
        route = respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        connector.search("人口", {"limit": 10, "offset": 5})

        request = route.calls[0].request
        assert "limit=10" in str(request.url) or "limit" in str(request.url)

    @respx.mock
    def test_API認証エラーでAuthenticationErrorを発生させる(self):
        """API が 403 を返した場合 AuthenticationError を発生させる。"""
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(403, json={"error": "forbidden"})
        )
        connector = EStatConnector()
        connector.initialize("invalid_key")
        with pytest.raises(AuthenticationError):
            connector.search("人口", {})

    @respx.mock
    def test_タイムアウトでUpstreamTimeoutErrorを発生させる(self):
        """リクエストタイムアウト時に UpstreamTimeoutError を発生させる。"""
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        with pytest.raises(UpstreamTimeoutError):
            connector.search("人口", {})

    @respx.mock
    def test_レート制限でUpstreamRateLimitErrorを発生させる(self):
        """上流が 429 を返した場合 UpstreamRateLimitError を発生させる。"""
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(429, json={"error": "rate limited"})
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        with pytest.raises(UpstreamRateLimitError):
            connector.search("人口", {})

    @respx.mock
    def test_検索結果ゼロ件でitemsが空のSearchResultを返す(self):
        """ヒットなしのレスポンスで items が空の SearchResult を返す（例外ではない）。"""
        empty_fixture = {
            "GET_STATS_LIST": {
                "RESULT": {"STATUS": 0, "ERROR_MSG": "正常終了"},
                "PARAMETER": {},
                "DATALIST_INF": {"NUMBER": 0, "TABLE_INF": []},
            }
        }
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(200, json=empty_fixture)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        result = connector.search("存在しない検索語", {})
        assert isinstance(result, SearchResult)
        assert len(result.items) == 0
        assert result.total_count == 0
        assert result.has_next is False


class TestEStatConnectorFetch:
    """EStatConnector.fetch() のテスト。"""

    @respx.mock
    def test_データ取得でDatasetPayloadを返す(self):
        """fetch は DatasetPayload を返す。"""
        fixture = load_fixture("estat_fetch_response.json")
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        payload = connector.fetch("estat:0003191203", "test_key")

        assert isinstance(payload, DatasetPayload)
        assert payload.metadata.id == "estat:0003191203"
        assert payload.format in ("json", "xml", "csv", "other")

    @respx.mock
    def test_タイムアウトでUpstreamTimeoutErrorを発生させる(self):
        """fetch のタイムアウト時に UpstreamTimeoutError を発生させる。"""
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        with pytest.raises(UpstreamTimeoutError):
            connector.fetch("estat:0003191203", "test_key")

    @respx.mock
    def test_レート制限でUpstreamRateLimitErrorを発生させる(self):
        """fetch で 429 を受信した場合 UpstreamRateLimitError を発生させる。"""
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData").mock(
            return_value=httpx.Response(429)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        with pytest.raises(UpstreamRateLimitError):
            connector.fetch("estat:0003191203", "test_key")

    def test_APIキー未設定時にAuthenticationErrorを発生させる(self):
        """APIキー未設定で fetch を呼ぶと AuthenticationError を発生させる。"""
        connector = EStatConnector()
        with pytest.raises(AuthenticationError):
            connector.fetch("estat:0003191203", None)


@pytest.mark.integration
def test_estat_実APIで検索できる():
    """【統合テスト】実際の e-Stat API で検索できる。ESTAT_API_KEY 必須。"""
    import os
    api_key = os.environ.get("ESTAT_API_KEY")
    if not api_key:
        pytest.skip("ESTAT_API_KEY が設定されていません")

    connector = EStatConnector()
    connector.initialize(api_key)
    result = connector.search("人口", {"limit": 3})
    assert len(result.items) > 0
