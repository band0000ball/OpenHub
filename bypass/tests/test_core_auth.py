"""
core/auth.py のユニットテスト

テスト対象の振る舞い:
- 有効な JWT トークン → Cognito sub (user_id) を返す
- 期限切れトークン → 401 Unauthorized
- 不正なトークン → 401 Unauthorized
- kid が JWKS に存在しない → 401 Unauthorized
- トークンなし（Authorization ヘッダーなし）→ 401 Unauthorized
- DISABLE_AUTH=true → 認証スキップ・"local_dev_user" を返す
- _get_jwks → httpx.get で JWKS エンドポイントを呼ぶ
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from jose import JWTError
from jose.exceptions import ExpiredSignatureError

import core.auth as auth_module
from core.auth import get_current_user

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
    """デフォルトで DISABLE_AUTH を無効にする。各テストはこれを上書き可能。"""
    monkeypatch.delenv("DISABLE_AUTH", raising=False)
    monkeypatch.setenv("COGNITO_REGION", "ap-northeast-1")
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "ap-northeast-1_TEST")
    monkeypatch.setenv("COGNITO_CLIENT_ID", "test-client-id")
    yield


# ---------------------------------------------------------------------------
# get_current_user のテスト
# ---------------------------------------------------------------------------


class TestGetCurrentUser:
    """get_current_user Dependency の振る舞いテスト。"""

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
            result = get_current_user(token=FAKE_TOKEN)

        assert result == "user-abc-123"

    def test_期限切れトークンで401を返す(self):
        """期限切れ JWT は 401 Unauthorized を返す。"""
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
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(token=FAKE_TOKEN)

        assert exc_info.value.status_code == 401
        assert "有効期限" in exc_info.value.detail

    def test_不正なトークンで401を返す(self):
        """不正な JWT は 401 Unauthorized を返す。"""
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
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(token=FAKE_TOKEN)

        assert exc_info.value.status_code == 401

    def test_kidが一致しない場合401を返す(self):
        """JWKS に一致する kid がない場合、401 Unauthorized を返す。"""
        with (
            patch("core.auth._get_jwks", return_value=FAKE_JWKS),
            patch(
                "core.auth.jwt.get_unverified_header",
                return_value={"kid": "unknown-kid-xxx"},
            ),
        ):
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(token=FAKE_TOKEN)

        assert exc_info.value.status_code == 401

    def test_トークンなしで401を返す(self):
        """Authorization ヘッダーなし（token=None）は 401 Unauthorized を返す。"""
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=None)

        assert exc_info.value.status_code == 401
        assert exc_info.value.headers.get("WWW-Authenticate") == "Bearer"

    def test_DISABLE_AUTH_trueで認証スキップしlocal_dev_userを返す(
        self, monkeypatch
    ):
        """DISABLE_AUTH=true のとき JWT 検証をスキップして local_dev_user を返す。"""
        monkeypatch.setenv("DISABLE_AUTH", "true")

        # パッチなしで呼んでも動作する（JWKS アクセスが起きない）
        result = get_current_user(token=None)

        assert result == "local_dev_user"

    def test_DISABLE_AUTH_falseは通常の検証を行う(self, monkeypatch):
        """DISABLE_AUTH=false のとき通常の JWT 検証を行う。"""
        monkeypatch.setenv("DISABLE_AUTH", "false")

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=None)

        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# _get_jwks のテスト
# ---------------------------------------------------------------------------


class TestGetJwks:
    """_get_jwks ヘルパーのテスト。"""

    def test_httpxでJWKSエンドポイントを取得する(self):
        """_get_jwks は指定 URL に GET リクエストして JWKS dict を返す。"""
        auth_module._get_jwks.cache_clear()

        mock_resp = MagicMock()
        mock_resp.json.return_value = FAKE_JWKS
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.get", return_value=mock_resp) as mock_httpx:
            result = auth_module._get_jwks("https://example.com/.well-known/jwks.json")

        mock_httpx.assert_called_once_with(
            "https://example.com/.well-known/jwks.json", timeout=5.0
        )
        assert result == FAKE_JWKS

        auth_module._get_jwks.cache_clear()


# ---------------------------------------------------------------------------
# 保護エンドポイントの統合テスト（TestClient 経由）
# ---------------------------------------------------------------------------


class TestProtectedEndpointIntegration:
    """保護エンドポイントに get_current_user を注入したときの動作テスト。"""

    @pytest.fixture
    def protected_client(self):
        """get_current_user を注入したテスト用 FastAPI クライアント。"""
        app = FastAPI()

        @app.get("/protected")
        def protected_route(user_id: str = Depends(get_current_user)):
            return {"user_id": user_id}

        # raise_server_exceptions=False にしないと HTTPException が再スローされる
        return TestClient(app, raise_server_exceptions=False)

    def test_Authorizationヘッダーなしで401を返す(self, protected_client):
        """Authorization ヘッダーを付けないリクエストは 401 を返す。"""
        response = protected_client.get("/protected")
        assert response.status_code == 401

    def test_DISABLE_AUTH_trueで認証スキップ(self, protected_client, monkeypatch):
        """DISABLE_AUTH=true のとき保護エンドポイントが local_dev_user を返す。"""
        monkeypatch.setenv("DISABLE_AUTH", "true")

        response = protected_client.get("/protected")

        assert response.status_code == 200
        assert response.json()["user_id"] == "local_dev_user"
