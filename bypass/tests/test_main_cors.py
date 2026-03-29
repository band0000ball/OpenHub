"""
main.py CORS 設定のユニットテスト

TDD RED フェーズ: amplifyapp.com を許可する CORS 設定がまだ存在しないため FAIL する。
"""

import pytest
from starlette.middleware.cors import CORSMiddleware

from main import create_app


def _get_cors_middleware(app):
    """アプリのミドルウェアスタックから CORSMiddleware を取り出す。"""
    for middleware in app.user_middleware:
        if middleware.cls is CORSMiddleware:
            return middleware
    return None


def test_cors_includes_amplifyapp() -> None:
    """CORS allow_origins に https://*.amplifyapp.com が含まれることを確認する。"""
    app = create_app()
    middleware = _get_cors_middleware(app)

    assert middleware is not None, "CORSMiddleware が登録されていない"
    origins = middleware.kwargs.get("allow_origins", [])
    assert "https://*.amplifyapp.com" in origins, (
        f"https://*.amplifyapp.com が allow_origins にない: {origins}"
    )


def test_cors_still_includes_localhost() -> None:
    """既存の localhost 設定が維持されていることを確認する（リグレッション防止）。"""
    app = create_app()
    middleware = _get_cors_middleware(app)

    assert middleware is not None
    origins = middleware.kwargs.get("allow_origins", [])

    expected_localhost_origins = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]
    for origin in expected_localhost_origins:
        assert origin in origins, f"{origin} が allow_origins から消えている: {origins}"
