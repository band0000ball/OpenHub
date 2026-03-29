"""
core/auth.py の get_current_user_optional のユニットテスト（TDD: RED フェーズ）

テスト対象の振る舞い:
- 有効な JWT トークン → Cognito sub (user_id) を返す
- 期限切れトークン → None を返す（401 にしない）
- 不正なトークン → None を返す（401 にしない）
- kid が JWKS に存在しない → None を返す（401 にしない）
- トークンなし（None）→ None を返す
- DISABLE_AUTH=true → "local_dev_user" を返す
"""

from unittest.mock import patch

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from jose import JWTError
from jose.exceptions import ExpiredSignatureError

import core.auth as auth_module
from core.auth import get_current_user_optional

# ---------------------------------------------------------------------------
# テスト用フィクスチャデータ
# ---------------------------------------------------------------------------

FAKE_JWKS = {
    "keys": [
        {
            "kid": "test-kid-1",
            "kty": "RSA",
            "n": "test-n",
            "e": "AQAB",
        }
    ]
}

FAKE_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2lkLTEifQ.fake.sig"


# ---------------------------------------------------------------------------
# オートユースフィクスチャ
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clear_jwks_cache():
    """各テストの前後に JWKS lru_cache をクリアする。"""
    auth_module._get_jwks.cache_clear()
    yield
    auth_module._get_jwks.cache_clear()


@pytest.fixture(autouse=True)
def disable_auth_off(monkeypatch):
    """デフォルトで DISABLE_AUTH を無効にする。"""
    monkeypatch.delenv("DISABLE_AUTH", raising=False)
    monkeypatch.setenv("COGNITO_REGION", "ap-northeast-1")
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "ap-northeast-1_TEST")
    monkeypatch.setenv("COGNITO_CLIENT_ID", "test-client-id")
    yield


# ---------------------------------------------------------------------------
# get_current_user_optional のテスト
# ---------------------------------------------------------------------------


class TestGetCurrentUserOptional:
    """get_current_user_optional Dependency の振る舞いテスト。"""

    def test_有効なトークンでuser_idを返す(self):
        """有効な JWT トークンを検証して Cognito sub (user_id) を返す。"""
        with (
            patch("core.auth._get_jwks", return_value=FAKE_JWKS),
            patch(
                "core.auth.jwt.get_unverified_header",
                return_value={"kid": "test-kid-1"},
            ),
            patch("core.auth.jwt.decode", return_value={"sub": "user-abc-123"}),
        ):
            result = get_current_user_optional(token=FAKE_TOKEN)

        assert result == "user-abc-123"

    def test_期限切れトークンでNoneを返す(self):
        """期限切れ JWT は None を返す（401 にしない）。"""
        with (
            patch("core.auth._get_jwks", return_value=FAKE_JWKS),
            patch(
                "core.auth.jwt.get_unverified_header",
                return_value={"kid": "test-kid-1"},
            ),
            patch(
                "core.auth.jwt.decode",
                side_effect=ExpiredSignatureError("token is expired"),
            ),
        ):
            result = get_current_user_optional(token=FAKE_TOKEN)

        assert result is None

    def test_不正なトークンでNoneを返す(self):
        """不正な JWT は None を返す（401 にしない）。"""
        with (
            patch("core.auth._get_jwks", return_value=FAKE_JWKS),
            patch(
                "core.auth.jwt.get_unverified_header",
                return_value={"kid": "test-kid-1"},
            ),
            patch(
                "core.auth.jwt.decode",
                side_effect=JWTError("invalid token"),
            ),
        ):
            result = get_current_user_optional(token=FAKE_TOKEN)

        assert result is None

    def test_kidが一致しない場合Noneを返す(self):
        """JWKS に一致する kid がない場合、None を返す（401 にしない）。"""
        with (
            patch("core.auth._get_jwks", return_value=FAKE_JWKS),
            patch(
                "core.auth.jwt.get_unverified_header",
                return_value={"kid": "unknown-kid-xxx"},
            ),
        ):
            result = get_current_user_optional(token=FAKE_TOKEN)

        assert result is None

    def test_トークンなしでNoneを返す(self):
        """Authorization ヘッダーなし（token=None）は None を返す（401 にしない）。"""
        result = get_current_user_optional(token=None)
        assert result is None

    def test_DISABLE_AUTH_trueでlocal_dev_userを返す(self, monkeypatch):
        """DISABLE_AUTH=true のとき JWT 検証をスキップして local_dev_user を返す。"""
        monkeypatch.setenv("DISABLE_AUTH", "true")
        result = get_current_user_optional(token=None)
        assert result == "local_dev_user"

    def test_DISABLE_AUTH_trueでトークンありでもlocal_dev_userを返す(self, monkeypatch):
        """DISABLE_AUTH=true のとき、有効なトークンでも local_dev_user を返す。"""
        monkeypatch.setenv("DISABLE_AUTH", "true")
        result = get_current_user_optional(token=FAKE_TOKEN)
        assert result == "local_dev_user"


# ---------------------------------------------------------------------------
# FastAPI 統合テスト（オプショナル認証エンドポイント）
# ---------------------------------------------------------------------------


class TestOptionalAuthEndpointIntegration:
    """get_current_user_optional を注入したエンドポイントの動作テスト。"""

    @pytest.fixture
    def optional_auth_client(self):
        """get_current_user_optional を注入したテスト用 FastAPI クライアント。"""
        app = FastAPI()

        @app.get("/optional")
        def optional_route(user_id: str | None = Depends(get_current_user_optional)):
            return {"user_id": user_id}

        return TestClient(app, raise_server_exceptions=False)

    def test_Authorizationヘッダーなしで200とuser_id_Noneを返す(
        self, optional_auth_client
    ):
        """Authorization ヘッダーなしでも 200 OK、user_id は None。"""
        response = optional_auth_client.get("/optional")
        assert response.status_code == 200
        assert response.json()["user_id"] is None

    def test_DISABLE_AUTH_trueで200とlocal_dev_userを返す(
        self, optional_auth_client, monkeypatch
    ):
        """DISABLE_AUTH=true のときオプショナル認証エンドポイントは local_dev_user を返す。"""
        monkeypatch.setenv("DISABLE_AUTH", "true")
        response = optional_auth_client.get("/optional")
        assert response.status_code == 200
        assert response.json()["user_id"] == "local_dev_user"
