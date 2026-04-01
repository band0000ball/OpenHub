"""
カバレッジ補強テスト

未カバーのパスを対象とする:
- search_all_sources の AuthenticationError スキップ
- datasets.py の例外ハンドラー関数
- credentials.py の has() メソッド
- connectors のサーバー 500 エラーパス
"""

import json

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from core.credentials import CredentialStore
from core.errors import (
    AuthenticationError,
    DatasetNotFoundError,
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)


class TestSearchAllSourcesSkipAuth:
    """search_all_sources の AuthenticationError スキップ動作テスト。"""

    def test_APIキー未設定ソースはスキップされ結果が返される(self, client: TestClient):
        """e-Stat APIキー未設定でも他ソースの結果を返す（スキップ、エラーにしない）。"""
        from core.models import SearchResult
        from tests.test_api_datasets import make_search_result

        # estat は AuthenticationError を発生させ、datagojp は結果を返す
        with pytest.MonkeyPatch().context() as mp:
            from connectors.estat import EStatConnector
            from connectors.datagojp import DataGoJpConnector

            def estat_raises(self, query, filters):
                raise AuthenticationError("APIキー未設定")

            def datagojp_returns(self, query, filters):
                return make_search_result(2)

            mp.setattr(EStatConnector, "search", estat_raises)
            mp.setattr(DataGoJpConnector, "search", datagojp_returns)

            response = client.get("/datasets/search?q=テスト")

        # e-Stat スキップ、datagojp 結果のみ
        assert response.status_code == 200
        body = response.json()
        assert "items" in body


class TestExceptionHandlers:
    """例外ハンドラーの直接テスト。"""

    def test_AuthenticationError_ハンドラーが401を返す(self):
        """handle_authentication_error は 401 JSONResponse を返す。"""
        from unittest.mock import MagicMock
        from api.datasets import handle_authentication_error
        request = MagicMock()
        exc = AuthenticationError("APIキー必須")
        response = handle_authentication_error(request, exc)
        assert response.status_code == 401
        body = json.loads(response.body)
        assert body["detail"] == "APIキー必須"

    def test_DatasetNotFoundError_ハンドラーが404を返す(self):
        """handle_not_found_error は 404 JSONResponse を返す。"""
        from unittest.mock import MagicMock
        from api.datasets import handle_not_found_error
        request = MagicMock()
        exc = DatasetNotFoundError("not found")
        response = handle_not_found_error(request, exc)
        assert response.status_code == 404

    def test_UpstreamTimeoutError_ハンドラーが504を返す(self):
        """handle_timeout_error は 504 JSONResponse を返す。"""
        from unittest.mock import MagicMock
        from api.datasets import handle_timeout_error
        request = MagicMock()
        exc = UpstreamTimeoutError("timeout")
        response = handle_timeout_error(request, exc)
        assert response.status_code == 504

    def test_UpstreamRateLimitError_ハンドラーが429を返す(self):
        """handle_rate_limit_error は 429 JSONResponse と Retry-After ヘッダーを返す。"""
        from unittest.mock import MagicMock
        from api.datasets import handle_rate_limit_error
        request = MagicMock()
        exc = UpstreamRateLimitError("rate limited")
        response = handle_rate_limit_error(request, exc)
        assert response.status_code == 429
        assert "Retry-After" in response.headers


class TestCredentialStoreHas:
    """CredentialStore.has() メソッドのテスト。"""

    def test_登録済みsource_idにTrueを返す(self):
        """has() は登録済みキーに True を返す。"""
        store = CredentialStore()
        store.set("estat", "test_key")
        assert store.has("estat") is True

    def test_未登録source_idにFalseを返す(self):
        """has() は未登録キーに False を返す。"""
        store = CredentialStore()
        assert store.has("nonexistent") is False

    def test_削除後にFalseを返す(self):
        """set 後に別のインスタンスで上書きしても has() は正確に動作する。"""
        store = CredentialStore()
        store.set("estat", "key1")
        assert store.has("estat") is True
        # 新しいストアでは持っていない
        new_store = CredentialStore()
        assert new_store.has("estat") is False


class TestConnectorServerErrors:
    """500系サーバーエラーを UpstreamTimeoutError に変換するテスト。"""

    @respx.mock
    def test_estat_500エラーでUpstreamTimeoutErrorを発生させる(self):
        """e-Stat が 500 を返した場合 UpstreamTimeoutError を発生させる。"""
        from connectors.estat import EStatConnector
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(500, json={"error": "server error"})
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        with pytest.raises(UpstreamTimeoutError):
            connector.search("人口", {})

    @respx.mock
    def test_datagojp_500エラーでUpstreamTimeoutErrorを発生させる(self):
        """data.go.jp が 500 を返した場合 UpstreamTimeoutError を発生させる。"""
        from connectors.datagojp import DataGoJpConnector
        respx.get("https://data.e-gov.go.jp/data/api/3/action/package_search").mock(
            return_value=httpx.Response(503, json={"error": "service unavailable"})
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.search("人口", {})

    @respx.mock
    def test_estat_fetch_500エラーでUpstreamTimeoutErrorを発生させる(self):
        """e-Stat fetch が 500 を返した場合 UpstreamTimeoutError を発生させる。"""
        from connectors.estat import EStatConnector
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData").mock(
            return_value=httpx.Response(500)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        with pytest.raises(UpstreamTimeoutError):
            connector.fetch("estat:0003191203", "test_key")

    @respx.mock
    def test_datagojp_fetch_500エラーでUpstreamTimeoutErrorを発生させる(self):
        """data.go.jp fetch が 500 を返した場合 UpstreamTimeoutError を発生させる。"""
        from connectors.datagojp import DataGoJpConnector
        respx.get("https://data.e-gov.go.jp/data/api/3/action/package_show").mock(
            return_value=httpx.Response(503)
        )
        connector = DataGoJpConnector()
        connector.initialize(None)
        with pytest.raises(UpstreamTimeoutError):
            connector.fetch("datagojp:test-dataset-id", None)


class TestEStatSingleResultParsing:
    """e-Stat 単一結果（dict 形式）のパースを検証する。"""

    @respx.mock
    def test_単一結果がdictの場合もリストとして返す(self):
        """TABLE_INF が dict（単一）でも DatasetMetadata のリストを返す。"""
        from connectors.estat import EStatConnector
        single_result = {
            "GET_STATS_LIST": {
                "RESULT": {"STATUS": 0, "ERROR_MSG": "正常終了"},
                "PARAMETER": {},
                "DATALIST_INF": {
                    "NUMBER": 1,
                    "TABLE_INF": {
                        "@id": "0003191203",
                        "STATISTICS_NAME": "国勢調査",
                        "TITLE": {"@no": "1", "$": "人口推計"},
                        "GOV_ORG": {"@code": "00200", "$": "総務省"},
                        "UPDATED_DATE": "2024-01-15",
                        "MAIN_CATEGORY": {"@code": "02", "$": "人口・世帯"},
                        "SUB_CATEGORY": {"@code": "01", "$": "人口"},
                    },
                },
            }
        }
        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList").mock(
            return_value=httpx.Response(200, json=single_result)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        result = connector.search("人口", {})
        assert len(result.items) == 1
        assert result.items[0].id == "estat:0003191203"


class TestEStatFetchWithTextTitle:
    """e-Stat fetch で TITLE が文字列の場合のパース検証。"""

    @respx.mock
    def test_タイトルが文字列の場合もパースできる(self):
        """TABLE_INF.TITLE が dict ではなく str の場合も正常にパースする。"""
        import json
        from pathlib import Path
        from connectors.estat import EStatConnector

        fixture_path = Path(__file__).parent / "fixtures" / "estat_fetch_response.json"
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        # TITLE を文字列に変更
        fixture["GET_STATS_DATA"]["STATISTICAL_DATA"]["TABLE_INF"]["TITLE"] = "人口推計"

        respx.get("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData").mock(
            return_value=httpx.Response(200, json=fixture)
        )
        connector = EStatConnector()
        connector.initialize("test_key")
        payload = connector.fetch("estat:0003191203", "test_key")
        assert payload.metadata.title == "人口推計"
