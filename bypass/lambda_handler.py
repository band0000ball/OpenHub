"""
AWS Lambda エントリーポイント

Mangum アダプターで FastAPI アプリを Lambda Function URL に対応させる。
"""

from mangum import Mangum

from main import create_app

app = create_app()
handler = Mangum(app, lifespan="off")
