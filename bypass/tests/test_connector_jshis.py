"""J-SHIS コネクターのユニットテスト"""

import pytest

from connectors.jshis import JshisConnector


class TestJshisConnectorSearch:
    def test_source_idが正しい(self):
        connector = JshisConnector()
        assert connector.source_id == "jshis"

    def test_空クエリで全件返す(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("", {})

        assert result.total_count > 0
        assert len(result.items) > 0
        assert all(item.source_id == "jshis" for item in result.items)

    def test_地震ハザードで検索できる(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("地震ハザード", {})

        assert result.total_count > 0
        assert all("地震ハザード" in " ".join(item.tags) or "地震ハザード" in item.title or "地震ハザード" in item.description for item in result.items)

    def test_活断層で検索できる(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("活断層", {})

        assert result.total_count > 0

    def test_地盤で検索できる(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("地盤", {})

        assert result.total_count > 0

    def test_limitとoffsetが動作する(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("", {"limit": 3, "offset": 0})

        assert len(result.items) == 3

    def test_offsetでページネーションできる(self):
        connector = JshisConnector()
        connector.initialize(None)
        page1 = connector.search("", {"limit": 3, "offset": 0})
        page2 = connector.search("", {"limit": 3, "offset": 3})

        assert page1.items[0].id != page2.items[0].id

    def test_idがjshisプレフィックスを持つ(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("", {"limit": 5})

        assert all(item.id.startswith("jshis:") for item in result.items)

    def test_urlがj_shisサイトを指す(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("", {"limit": 1})

        assert "j-shis.bosai.go.jp" in result.items[0].url

    def test_マッチしないキーワードは0件(self):
        connector = JshisConnector()
        connector.initialize(None)
        result = connector.search("存在しないデータ", {})

        assert result.total_count == 0
        assert len(result.items) == 0
