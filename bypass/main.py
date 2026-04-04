"""
OpenHub アプリケーションエントリーポイント

create_app() ファクトリ関数でアプリを生成する（テスト時の依存注入を容易にする）。
"""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.cache import router as cache_router
from api.datasets import (
    handle_authentication_error,
    handle_not_found_error,
    handle_rate_limit_error,
    handle_timeout_error,
    router as datasets_router,
    sources_router,
)
from core.errors import (
    AuthenticationError,
    DatasetNotFoundError,
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)

# 構造化ログの基本設定（JSON 行形式）
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    stream=sys.stdout,
)


def create_app() -> FastAPI:
    """FastAPI アプリケーションを生成して返す。

    テスト・本番両方でこの関数を使う。
    依存関係のオーバーライドはアプリインスタンスごとに行う。

    Returns:
        設定済み FastAPI インスタンス
    """
    app = FastAPI(
        title="OpenHub",
        summary="日本のオープンデータ統合APIゲートウェイ",
        version="0.1.0",
    )

    # CORS: localhost + Amplify ホスティングを許可
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost",
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
            "https://*.amplifyapp.com",  # Amplify デプロイ用
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ドメイン例外のグローバルハンドラー登録
    app.add_exception_handler(AuthenticationError, handle_authentication_error)
    app.add_exception_handler(DatasetNotFoundError, handle_not_found_error)
    app.add_exception_handler(UpstreamTimeoutError, handle_timeout_error)
    app.add_exception_handler(UpstreamRateLimitError, handle_rate_limit_error)

    # ルーター登録
    app.include_router(auth_router)
    app.include_router(cache_router)
    app.include_router(datasets_router)
    app.include_router(sources_router)

    return app


# uvicorn main:app でも動作するようにモジュールレベルインスタンスを公開する
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
