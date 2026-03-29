"""
DynamoDBCredentialStore — DynamoDB を使った永続的 APIキー管理

設計方針:
- (user_id, source_id) をキーとして DynamoDB に APIキーを永続化する
- user_id=None はサポートしない（None を渡されたら APIキーなし扱いで None を返す）
- APIキーをログ・例外メッセージに含めない
- テーブル名は環境変数 DYNAMODB_TABLE_NAME で設定（デフォルト: openhub-credentials）

DynamoDB テーブルスキーマ:
- パーティションキー: user_id (String)
- ソートキー: source_id (String)
- 属性: api_key (String), updated_at (String / ISO 8601)
"""

import os
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key


class DynamoDBCredentialStore:
    """(user_id, source_id) → api_key を DynamoDB に永続化するストア。

    user_id=None の場合は APIキーなし扱いとして None を返す。
    """

    DEFAULT_TABLE_NAME = "openhub-credentials"

    def __init__(
        self,
        table_name: str | None = None,
        region_name: str = "ap-northeast-1",
    ) -> None:
        """初期化。

        Args:
            table_name: DynamoDB テーブル名。
                        None の場合は環境変数 DYNAMODB_TABLE_NAME またはデフォルト値を使用。
            region_name: AWS リージョン名。
        """
        self.table_name = (
            table_name
            or os.environ.get("DYNAMODB_TABLE_NAME", self.DEFAULT_TABLE_NAME)
        )
        self._resource = boto3.resource("dynamodb", region_name=region_name)
        self._table = self._resource.Table(self.table_name)

    def save(self, user_id: str | None, source_id: str, api_key: str) -> None:
        """APIキーを DynamoDB に保存または上書きする。

        user_id=None の場合は何もしない（DynamoDB はスキーマ違反になるため）。

        Args:
            user_id: ユーザーID。None の場合は保存をスキップする。
            source_id: データソース識別子（例: "estat"）
            api_key: APIキー（ログに出力してはいけない）
        """
        if user_id is None:
            return

        self._table.put_item(
            Item={
                "user_id": user_id,
                "source_id": source_id,
                "api_key": api_key,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    def get(self, user_id: str | None, source_id: str) -> str | None:
        """登録済み APIキーを取得する。未登録または user_id=None の場合は None。

        Args:
            user_id: ユーザーID。None の場合は None を返す。
            source_id: データソース識別子

        Returns:
            APIキーまたは None
        """
        if user_id is None:
            return None

        response = self._table.get_item(
            Key={"user_id": user_id, "source_id": source_id}
        )
        item = response.get("Item")
        if item is None:
            return None
        return item.get("api_key")

    def is_configured(self, user_id: str | None, source_id: str) -> bool:
        """指定 (user_id, source_id) の APIキーが登録されているか確認する。

        user_id=None の場合は常に False を返す。

        Args:
            user_id: ユーザーID。None の場合は False を返す。
            source_id: データソース識別子

        Returns:
            登録済みなら True
        """
        if user_id is None:
            return False

        return self.get(user_id, source_id) is not None
