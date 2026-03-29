"""
lambda_handler モジュールのユニットテスト

TDD RED フェーズ: lambda_handler.py が存在しないため、このテストは最初に FAIL する。
"""

import pytest


def test_handler_is_mangum_instance() -> None:
    """lambda_handler.handler が Mangum インスタンスであることを確認する。"""
    from mangum import Mangum  # noqa: PLC0415

    from lambda_handler import handler  # noqa: PLC0415

    assert isinstance(handler, Mangum)


def test_handler_wraps_fastapi_app() -> None:
    """Mangum が create_app() の FastAPI インスタンスをラップしていることを確認する。"""
    from fastapi import FastAPI  # noqa: PLC0415

    from lambda_handler import handler  # noqa: PLC0415

    # Mangum は内部で app 属性にラップ対象を保持する
    assert isinstance(handler.app, FastAPI)
