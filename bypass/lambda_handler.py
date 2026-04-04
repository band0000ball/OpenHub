"""
AWS Lambda エントリーポイント

Mangum アダプターで FastAPI アプリを Lambda Function URL に対応させる。
EventBridge の warm ping イベントを受けた場合は S3 キャッシュをプリロードして即時返却する。
"""

import logging

from mangum import Mangum

from main import create_app

logger = logging.getLogger(__name__)

app = create_app()
_mangum = Mangum(app, lifespan="off")


def handler(event, context):
    """Lambda ハンドラー。warm ping はキャッシュプリロードのみ実行して即時返却。"""
    if event.get("warm"):
        logger.info("Warm ping received — preloading S3 cache")
        try:
            from api.cache import _get_all_items
            items = _get_all_items()
            logger.info("Cache preloaded: %d items", len(items))
        except Exception as exc:
            logger.warning("Cache preload failed: %s", exc)
        return {"statusCode": 200, "body": "warm"}

    return _mangum(event, context)
