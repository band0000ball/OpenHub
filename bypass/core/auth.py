"""
Cognito JWT 検証ミドルウェア

設計方針:
- DISABLE_AUTH=true のとき認証スキップ（ローカル開発用）
- python-jose で RS256 JWT を検証する
- JWKS 公開鍵は lru_cache でプロセス内キャッシュ（Cognito レート制限回避）
- 検証失敗は常に 401 Unauthorized
"""

import os
from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError

# auto_error=False: Authorization ヘッダーなし → None（401 は get_current_user で発行）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

LOCAL_DEV_USER = "local_dev_user"


@lru_cache(maxsize=1)
def _get_jwks(jwks_url: str) -> dict:
    """Cognito JWKS エンドポイントから公開鍵セットを取得する。

    lru_cache により同一 URL へのリクエストはプロセス内でキャッシュされる。
    テスト時は _get_jwks.cache_clear() で無効化すること。

    Args:
        jwks_url: JWKS エンドポイントの URL

    Returns:
        JWKS dict
    """
    response = httpx.get(jwks_url, timeout=5.0)
    response.raise_for_status()
    return response.json()


def get_current_user(token: str | None = Depends(oauth2_scheme)) -> str:
    """JWT トークンを検証し、Cognito sub（user_id）を返す FastAPI Dependency。

    DISABLE_AUTH=true の場合は "local_dev_user" を返して検証をスキップする。
    Sprint 3.2 で user_id を CredentialStore のキーとして使用する（現在は受け取るのみ）。

    Args:
        token: Bearer トークン文字列（Authorization ヘッダーなしの場合 None）

    Returns:
        user_id (Cognito sub, or "local_dev_user" when DISABLE_AUTH=true)

    Raises:
        HTTPException 401: トークンなし・無効・期限切れ
    """
    if os.environ.get("DISABLE_AUTH", "false").lower() == "true":
        return LOCAL_DEV_USER

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証トークンが必要です。",
            headers={"WWW-Authenticate": "Bearer"},
        )

    region = os.environ.get("COGNITO_REGION", "ap-northeast-1")
    pool_id = os.environ.get("COGNITO_USER_POOL_ID", "")
    client_id = os.environ.get("COGNITO_CLIENT_ID", "")
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"
    jwks_url = (
        f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"
    )

    try:
        jwks = _get_jwks(jwks_url)
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = next((k for k in jwks["keys"] if k.get("kid") == kid), None)

        if key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無効なトークンです（kid 不一致）。",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Cognito access_token は aud クレームを持たず client_id クレームを使う。
        # id_token は aud を持つ。両方に対応するため、まず aud で試し、
        # 失敗したら client_id クレームで検証する。
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=client_id,
                issuer=issuer,
            )
        except JWTError:
            # access_token: aud なし → audience チェックをスキップして検証
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=issuer,
                options={"verify_aud": False},
            )
            # client_id クレームで手動検証
            token_client_id = payload.get("client_id", "")
            if token_client_id != client_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="無効なトークンです（client_id 不一致）。",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        return str(payload["sub"])

    except ExpiredSignatureError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="トークンの有効期限が切れています。",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なトークンです。",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


def get_current_user_optional(token: str | None = Depends(oauth2_scheme)) -> str | None:
    """認証オプション版 Dependency。トークンなし・無効時は None を返す（401 にしない）。

    DISABLE_AUTH=true の場合は "local_dev_user" を返して検証をスキップする。
    トークンなし・期限切れ・不正なトークン・kid 不一致の場合はすべて None を返す。

    Args:
        token: Bearer トークン文字列（Authorization ヘッダーなしの場合 None）

    Returns:
        user_id (Cognito sub) / "local_dev_user" (DISABLE_AUTH=true) / None
    """
    if os.environ.get("DISABLE_AUTH", "false").lower() == "true":
        return LOCAL_DEV_USER

    if token is None:
        return None

    region = os.environ.get("COGNITO_REGION", "ap-northeast-1")
    pool_id = os.environ.get("COGNITO_USER_POOL_ID", "")
    client_id = os.environ.get("COGNITO_CLIENT_ID", "")
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"
    jwks_url = (
        f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"
    )

    try:
        jwks = _get_jwks(jwks_url)
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = next((k for k in jwks["keys"] if k.get("kid") == kid), None)

        if key is None:
            return None

        # Cognito access_token は aud クレームを持たない（client_id クレームを使う）
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=client_id,
                issuer=issuer,
            )
        except JWTError:
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=issuer,
                options={"verify_aud": False},
            )
            if payload.get("client_id", "") != client_id:
                return None

        return str(payload["sub"])

    except (HTTPException, JWTError, ExpiredSignatureError):
        return None
