"""
GET /sources エンドポイントのテスト

テスト対象の振る舞い:
- 登録済みソース一覧を返す
- 各ソースに id, label, requires_api_key が含まれる
- estat は requires_api_key=True、datagojp は False
"""

from fastapi.testclient import TestClient


class TestGetSources:
    """GET /sources のテスト。"""

    def test_登録済みソース一覧を返す(self, client: TestClient):
        """200 でソース一覧を返す。"""
        response = client.get("/sources")
        assert response.status_code == 200
        sources = response.json()
        assert len(sources) >= 2

    def test_各ソースに必須フィールドが含まれる(self, client: TestClient):
        """各ソースに id, label, requires_api_key が含まれる。"""
        response = client.get("/sources")
        for source in response.json():
            assert "id" in source
            assert "label" in source
            assert "requires_api_key" in source

    def test_estat_はAPIキー必須(self, client: TestClient):
        """estat は requires_api_key=True。"""
        response = client.get("/sources")
        sources = {s["id"]: s for s in response.json()}
        assert sources["estat"]["requires_api_key"] is True

    def test_datagojp_はAPIキー不要(self, client: TestClient):
        """datagojp は requires_api_key=False。"""
        response = client.get("/sources")
        sources = {s["id"]: s for s in response.json()}
        assert sources["datagojp"]["requires_api_key"] is False

    def test_ソースIDがCONNECTOR_FACTORIESと一致する(self, client: TestClient):
        """返されるソース ID が _CONNECTOR_FACTORIES のキーと一致する。"""
        from api.datasets import _CONNECTOR_FACTORIES
        response = client.get("/sources")
        source_ids = {s["id"] for s in response.json()}
        assert source_ids == set(_CONNECTOR_FACTORIES.keys())
