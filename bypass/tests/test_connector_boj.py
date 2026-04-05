"""
BOJ 日銀統計 API コネクターのユニットテスト

テスト対象:
- search(): キーワード検索 → SearchResult
- /getMetadata レスポンスのパース
- SERIES_CODE が空のヘッダー行のスキップ
- エラーハンドリング: タイムアウト、サーバーエラー
"""

import json
from pathlib import Path

import httpx
import pytest
import respx

from connectors.boj import BojConnector
from core.errors import UpstreamTimeoutError

FIXTURES_DIR = Path(__file__).parent / "fixtures"

_METADATA_URL = "https://www.stat-search.boj.or.jp/api/v1/getMetadata"


def _load_fixture(name: str) -> dict:
    path = FIXTURES_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


class TestBojConnectorSearch:
    def test_source_idが正しい(self):
        connector = BojConnector()
        assert connector.source_id == "boj"

    def test_APIキーなしで初期化できる(self):
        connector = BojConnector()
        connector.initialize(None)

    @respx.mock
    def test_検索結果をSearchResultに変換する(self):
        fixture = _load_fixture("boj_metadata_response.json")
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        result = connector.search("ドル", {})

        # SERIES_CODE が空のヘッダー行はスキップされる
        assert len(result.items) == 2
        assert result.items[0].source_id == "boj"
        assert result.items[0].id == "boj:FXERD01"

    @respx.mock
    def test_SERIES_CODEが空の行はスキップされる(self):
        fixture = _load_fixture("boj_metadata_response.json")
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        result = connector.search("ドル", {})

        # 3件中1件はヘッダー行（SERIES_CODE空）なので2件
        ids = [item.id for item in result.items]
        assert "boj:" not in ids  # 空コードのアイテムがないこと

    @respx.mock
    def test_titleに日本語名が設定される(self):
        fixture = _load_fixture("boj_metadata_response.json")
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        result = connector.search("ドル", {})

        assert result.items[0].title == "東京市場　ドル・円　スポット　9時時点"

    @respx.mock
    def test_descriptionにカテゴリと単位が含まれる(self):
        fixture = _load_fixture("boj_metadata_response.json")
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        result = connector.search("ドル", {})

        assert "外国為替市況" in result.items[0].description
        assert "￥／＄" in result.items[0].description

    @respx.mock
    def test_tagsにカテゴリと頻度が含まれる(self):
        fixture = _load_fixture("boj_metadata_response.json")
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        result = connector.search("ドル", {})

        tags = result.items[0].tags
        assert "外国為替市況" in tags
        assert "DAILY" in tags

    @respx.mock
    def test_updated_atがLAST_UPDATEから設定される(self):
        fixture = _load_fixture("boj_metadata_response.json")
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        result = connector.search("ドル", {})

        assert result.items[0].updated_at == "2026-04-03T00:00:00+09:00"

    @respx.mock
    def test_urlがstat_search閲覧ページになる(self):
        fixture = _load_fixture("boj_metadata_response.json")
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        result = connector.search("ドル", {})

        assert "stat-search.boj.or.jp" in result.items[0].url
        assert "FXERD01" in result.items[0].url

    @respx.mock
    def test_keywordパラメータがリクエストに含まれる(self):
        fixture = _load_fixture("boj_metadata_response.json")
        route = respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = BojConnector()
        connector.initialize(None)
        connector.search("為替", {})

        called_url = str(route.calls[0].request.url)
        assert "keyword=" in called_url

    @respx.mock
    def test_タイムアウト時にUpstreamTimeoutErrorを送出する(self):
        respx.get(_METADATA_URL).mock(side_effect=httpx.TimeoutException("timeout"))
        connector = BojConnector()
        connector.initialize(None)

        with pytest.raises(UpstreamTimeoutError):
            connector.search("為替", {})

    @respx.mock
    def test_サーバーエラー時にUpstreamTimeoutErrorを送出する(self):
        respx.get(_METADATA_URL).mock(
            return_value=httpx.Response(500)
        )
        connector = BojConnector()
        connector.initialize(None)

        with pytest.raises(UpstreamTimeoutError):
            connector.search("為替", {})
