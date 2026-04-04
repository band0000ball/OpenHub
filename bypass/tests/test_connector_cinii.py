"""
CiNii Research コネクターのユニットテスト

テスト対象:
- search(): キーワード検索 → SearchResult
- JSON-LD レスポンスのパース（dc:subject, dc:creator, HTML タグ除去）
- ページネーション（start 1-based, count max 200）
- エラーハンドリング: タイムアウト、サーバーエラー
"""

import json
from pathlib import Path

import httpx
import pytest
import respx

from connectors.cinii import CiNiiConnector
from core.errors import UpstreamRateLimitError, UpstreamTimeoutError

FIXTURES_DIR = Path(__file__).parent / "fixtures"

_SEARCH_URL = "https://cir.nii.ac.jp/opensearch/all"


def _load_fixture(name: str) -> dict:
    path = FIXTURES_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


class TestCiNiiConnectorSearch:
    def test_source_idが正しい(self):
        connector = CiNiiConnector()
        assert connector.source_id == "cinii"

    def test_APIキーなしで初期化できる(self):
        connector = CiNiiConnector()
        connector.initialize(None)

    @respx.mock
    def test_検索結果をSearchResultに変換する(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {})

        assert len(result.items) == 2
        assert result.items[0].source_id == "cinii"
        assert result.items[0].id == "cinii:1362825893369700096"
        assert result.items[0].title == "Artificial Intelligence (AI) Ethics"

    @respx.mock
    def test_total_countが正しく取得される(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {})

        assert result.total_count == 134192

    @respx.mock
    def test_has_nextが正しく判定される(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {"limit": 2, "offset": 0})

        assert result.has_next is True

    @respx.mock
    def test_dc_subjectがtagsに含まれる(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {})

        tags = result.items[0].tags
        assert "artificial intelligence" in tags
        assert "ethics" in tags
        assert "AI" in tags

    @respx.mock
    def test_dc_typeがtagsに含まれる(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {})

        assert "Article" in result.items[0].tags

    @respx.mock
    def test_descriptionのHTMLタグが除去される(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {})

        desc = result.items[0].description
        assert "<p>" not in desc
        assert "</p>" not in desc
        assert "Artificial intelligence" in desc

    @respx.mock
    def test_dc_creatorは最大3名までtagsに含まれる(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {})

        # 2番目のアイテムは著者4名だが最大3名まで
        item2_tags = result.items[1].tags
        assert "山田太郎" in item2_tags
        assert "鈴木花子" in item2_tags
        assert "田中一郎" in item2_tags
        assert "佐藤次郎" not in item2_tags

    @respx.mock
    def test_limitが200を超える場合200にクリップされる(self):
        fixture = _load_fixture("cinii_search_response.json")
        route = respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        connector.search("AI", {"limit": 500, "offset": 0})

        called_url = str(route.calls[0].request.url)
        assert "count=200" in called_url

    @respx.mock
    def test_offsetが1basedのstartに変換される(self):
        fixture = _load_fixture("cinii_search_response.json")
        route = respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        connector.search("AI", {"limit": 20, "offset": 100})

        called_url = str(route.calls[0].request.url)
        assert "start=101" in called_url

    @respx.mock
    def test_タイムアウト時にUpstreamTimeoutErrorを送出する(self):
        respx.get(_SEARCH_URL).mock(side_effect=httpx.TimeoutException("timeout"))
        connector = CiNiiConnector()
        connector.initialize(None)

        with pytest.raises(UpstreamTimeoutError):
            connector.search("AI", {})

    @respx.mock
    def test_サーバーエラー時にUpstreamTimeoutErrorを送出する(self):
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(500)
        )
        connector = CiNiiConnector()
        connector.initialize(None)

        with pytest.raises(UpstreamTimeoutError):
            connector.search("AI", {})

    @respx.mock
    def test_urlがCiNii詳細ページになる(self):
        fixture = _load_fixture("cinii_search_response.json")
        respx.get(_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = CiNiiConnector()
        connector.initialize(None)
        result = connector.search("AI", {})

        assert result.items[0].url == "https://cir.nii.ac.jp/crid/1362825893369700096"
