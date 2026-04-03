"""
e-Gov 法令 API コネクターのユニットテスト

テスト対象:
- search(): キーワード検索 → SearchResult
- fetch(): 法令全文取得 → DatasetPayload
- エラーハンドリング: タイムアウト、レート制限、サーバーエラー
"""

import json
from pathlib import Path

import httpx
import pytest
import respx

from connectors.egov_law import EGovLawConnector
from core.errors import UpstreamRateLimitError, UpstreamTimeoutError

FIXTURES_DIR = Path(__file__).parent / "fixtures"

_KEYWORD_URL = "https://laws.e-gov.go.jp/api/2/keyword"
_LAW_DATA_URL = "https://laws.e-gov.go.jp/api/2/law_data/415AC0000000057"


def _load_fixture(name: str) -> dict:
    path = FIXTURES_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


class TestEGovLawConnectorSearch:
    """search() のテスト。"""

    def test_source_idが正しい(self):
        connector = EGovLawConnector()
        assert connector.source_id == "egov_law"

    def test_APIキーなしで初期化できる(self):
        connector = EGovLawConnector()
        connector.initialize(None)

    @respx.mock
    def test_検索結果をSearchResultに変換する(self):
        fixture = _load_fixture("egov_law_search_response.json")
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        result = connector.search("個人情報", {})

        assert len(result.items) == 2
        assert result.items[0].source_id == "egov_law"
        assert result.items[0].id == "egov_law:415AC0000000057"
        assert result.items[0].title == "個人情報の保護に関する法律"

    @respx.mock
    def test_total_countが正しく取得される(self):
        fixture = _load_fixture("egov_law_search_response.json")
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        result = connector.search("個人情報", {})
        assert result.total_count == 42

    @respx.mock
    def test_has_nextが正しく判定される(self):
        fixture = _load_fixture("egov_law_search_response.json")
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        result = connector.search("個人情報", {"limit": 20, "offset": 0})
        # total_count=42, offset=0, items=2 → 0+2 < 42 → True
        assert result.has_next is True

    @respx.mock
    def test_keywordパラメータが正しく送信される(self):
        fixture = _load_fixture("egov_law_search_response.json")
        route = respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        connector.search("税法", {})

        assert route.called
        request_url = str(route.calls[0].request.url)
        assert "keyword=%E7%A8%8E%E6%B3%95" in request_url

    @respx.mock
    def test_limitとoffsetが正しく渡される(self):
        fixture = _load_fixture("egov_law_search_response.json")
        route = respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        connector.search("税法", {"limit": 10, "offset": 5})

        request_url = str(route.calls[0].request.url)
        assert "limit=10" in request_url
        assert "offset=5" in request_url

    @respx.mock
    def test_検索結果ゼロ件で空のSearchResultを返す(self):
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json={"items": [], "total_count": 0})
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        result = connector.search("存在しないキーワード", {})
        assert len(result.items) == 0
        assert result.total_count == 0
        assert result.has_next is False

    @respx.mock
    def test_タイムアウトでUpstreamTimeoutErrorを発生させる(self):
        respx.get(_KEYWORD_URL).mock(side_effect=httpx.TimeoutException("timeout"))
        connector = EGovLawConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.search("テスト", {})

    @respx.mock
    def test_レート制限でUpstreamRateLimitErrorを発生させる(self):
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(429, json={"error": "rate limited"})
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamRateLimitError):
            connector.search("テスト", {})

    @respx.mock
    def test_サーバーエラーでUpstreamTimeoutErrorを発生させる(self):
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(500, json={"error": "server error"})
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.search("テスト", {})

    @respx.mock
    def test_法令URLが正しく設定される(self):
        fixture = _load_fixture("egov_law_search_response.json")
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        result = connector.search("個人情報", {})
        assert result.items[0].url == "https://laws.e-gov.go.jp/law/415AC0000000057"

    @respx.mock
    def test_tagsにlaw_typeとcategoryが含まれる(self):
        fixture = _load_fixture("egov_law_search_response.json")
        respx.get(_KEYWORD_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        result = connector.search("個人情報", {})
        assert "Act" in result.items[0].tags
        assert "行政" in result.items[0].tags


class TestEGovLawConnectorFetch:
    """fetch() のテスト。"""

    @respx.mock
    def test_法令データ取得でDatasetPayloadを返す(self):
        fixture = _load_fixture("egov_law_fetch_response.json")
        respx.get(_LAW_DATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        payload = connector.fetch("egov_law:415AC0000000057", None)

        assert payload.metadata.title == "個人情報の保護に関する法律"
        assert payload.format == "json"

    @respx.mock
    def test_dataset_idプレフィックスが除去される(self):
        fixture = _load_fixture("egov_law_fetch_response.json")
        route = respx.get(_LAW_DATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        connector.fetch("egov_law:415AC0000000057", None)

        request_url = str(route.calls[0].request.url)
        assert "415AC0000000057" in request_url
        assert "egov_law:" not in request_url

    @respx.mock
    def test_タイムアウトでUpstreamTimeoutErrorを発生させる(self):
        respx.get(_LAW_DATA_URL).mock(side_effect=httpx.TimeoutException("timeout"))
        connector = EGovLawConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.fetch("egov_law:415AC0000000057", None)

    @respx.mock
    def test_レート制限でUpstreamRateLimitErrorを発生させる(self):
        respx.get(_LAW_DATA_URL).mock(
            return_value=httpx.Response(429, json={"error": "rate limited"})
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamRateLimitError):
            connector.fetch("egov_law:415AC0000000057", None)

    @respx.mock
    def test_metadataのdescriptionに法令番号が設定される(self):
        fixture = _load_fixture("egov_law_fetch_response.json")
        respx.get(_LAW_DATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EGovLawConnector()
        connector.initialize(None)
        payload = connector.fetch("egov_law:415AC0000000057", None)
        assert payload.metadata.description == "平成十五年法律第五十七号"
