"""
POST /auth/credentials エンドポイントのテスト

テスト対象の振る舞い:
- 正常なAPIキー設定 → 200 OK
- 上書き（同じソースへの再登録）→ 200 OK
- source_id 未指定 → 422 Unprocessable Entity
- api_key が空文字 → 422 Unprocessable Entity
- APIキーがレスポンスに含まれない（情報漏洩防止）
- 未知の source_id → 404 Not Found
"""

import pytest
from fastapi.testclient import TestClient


class TestPostAuthCredentials:
    """POST /auth/credentials エンドポイントのテスト。"""

    def test_正常なAPIキー設定で200を返す(self, client: TestClient):
        """有効な source_id と api_key で 200 OK を返す。"""
        response = client.post(
            "/auth/credentials",
            json={"source_id": "estat", "api_key": "test_api_key_12345"},
        )
        assert response.status_code == 200

    def test_レスポンスにAPIキーが含まれない(self, client: TestClient):
        """情報漏洩防止のため、レスポンスボディに api_key を含めない。"""
        response = client.post(
            "/auth/credentials",
            json={"source_id": "estat", "api_key": "super_secret_key"},
        )
        assert response.status_code == 200
        body = response.json()
        assert "super_secret_key" not in str(body)
        assert "api_key" not in body

    def test_レスポンスにsource_idとメッセージが含まれる(self, client: TestClient):
        """レスポンスには source_id と成功メッセージが含まれる。"""
        response = client.post(
            "/auth/credentials",
            json={"source_id": "estat", "api_key": "test_key"},
        )
        body = response.json()
        assert body["source_id"] == "estat"
        assert "message" in body

    def test_同一ソースへの上書きで200を返す(self, client: TestClient):
        """同じ source_id への再登録（上書き）は 200 OK を返す。"""
        client.post(
            "/auth/credentials",
            json={"source_id": "estat", "api_key": "first_key"},
        )
        response = client.post(
            "/auth/credentials",
            json={"source_id": "estat", "api_key": "second_key"},
        )
        assert response.status_code == 200

    def test_source_id未指定で422を返す(self, client: TestClient):
        """source_id が未指定の場合 422 Unprocessable Entity を返す。"""
        response = client.post(
            "/auth/credentials",
            json={"api_key": "test_key"},
        )
        assert response.status_code == 422

    def test_api_key未指定で422を返す(self, client: TestClient):
        """api_key が未指定の場合 422 Unprocessable Entity を返す。"""
        response = client.post(
            "/auth/credentials",
            json={"source_id": "estat"},
        )
        assert response.status_code == 422

    def test_api_keyが空文字で422を返す(self, client: TestClient):
        """api_key が空文字の場合 422 Unprocessable Entity を返す。"""
        response = client.post(
            "/auth/credentials",
            json={"source_id": "estat", "api_key": ""},
        )
        assert response.status_code == 422

    def test_未知のsource_idで404を返す(self, client: TestClient):
        """登録されていない source_id には 404 Not Found を返す。"""
        response = client.post(
            "/auth/credentials",
            json={"source_id": "unknown_source", "api_key": "test_key"},
        )
        assert response.status_code == 404

    def test_リクエストボディがJSONでない場合422を返す(self, client: TestClient):
        """Content-Type が application/json でない場合 422 を返す。"""
        response = client.post(
            "/auth/credentials",
            data="not json",
            headers={"Content-Type": "text/plain"},
        )
        assert response.status_code == 422

    def test_datagojpはAPIキー不要だが設定を受け入れる(self, client: TestClient):
        """data.go.jp は無認証だが、任意の api_key 設定は受け入れる。"""
        response = client.post(
            "/auth/credentials",
            json={"source_id": "datagojp", "api_key": "optional_key"},
        )
        assert response.status_code == 200
