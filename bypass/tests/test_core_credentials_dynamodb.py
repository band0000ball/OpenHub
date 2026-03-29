"""
DynamoDBCredentialStore のユニットテスト（TDD: RED フェーズ）

テスト対象の振る舞い:
- save(user_id, source_id, api_key) で DynamoDB にアイテムを書き込む
- get(user_id, source_id) で保存済みキーを取得する
- get で未登録の場合 None を返す
- is_configured(user_id, source_id) で登録有無を確認する
- user_id=None の場合は None を返す（APIキーなし扱い）
- updated_at が ISO 8601 形式で保存される
- 環境変数 DYNAMODB_TABLE_NAME でテーブル名を設定できる
- デフォルトテーブル名は "openhub-credentials"
- 異なる user_id のキーは独立する（ユーザー分離）

moto を使って実際の DynamoDB を叩かない。
"""

import os

import boto3
import pytest
from moto import mock_aws

from core.credentials_dynamodb import DynamoDBCredentialStore

# テスト用テーブル名
TEST_TABLE_NAME = "test-openhub-credentials"


@pytest.fixture
def aws_credentials(monkeypatch):
    """moto 用のダミー AWS 認証情報を設定する。"""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-northeast-1")


@pytest.fixture
def dynamodb_table(aws_credentials):
    """moto でモック DynamoDB テーブルを作成するフィクスチャ。"""
    with mock_aws():
        client = boto3.client("dynamodb", region_name="ap-northeast-1")
        client.create_table(
            TableName=TEST_TABLE_NAME,
            KeySchema=[
                {"AttributeName": "user_id", "KeyType": "HASH"},
                {"AttributeName": "source_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "user_id", "AttributeType": "S"},
                {"AttributeName": "source_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        yield TEST_TABLE_NAME


@pytest.fixture
def store(dynamodb_table):
    """テスト用 DynamoDBCredentialStore（moto 内）。"""
    return DynamoDBCredentialStore(
        table_name=dynamodb_table,
        region_name="ap-northeast-1",
    )


# ---------------------------------------------------------------------------
# save / get の基本動作
# ---------------------------------------------------------------------------


class TestSaveAndGet:
    """save と get の基本動作テスト。"""

    def test_保存したキーをgetで取得できる(self, store, dynamodb_table):
        """save した api_key を同じ user_id と source_id で get できる。"""
        with mock_aws():
            store.save("user1", "estat", "api-key-abc")
            result = store.get("user1", "estat")
        assert result == "api-key-abc"

    def test_未登録のキーはNoneを返す(self, store, dynamodb_table):
        """未登録の (user_id, source_id) に対して get は None を返す。"""
        with mock_aws():
            result = store.get("user1", "estat")
        assert result is None

    def test_異なるsource_idは独立する(self, store, dynamodb_table):
        """同一 user_id でも source_id が異なればキーは独立する。"""
        with mock_aws():
            store.save("user1", "estat", "key-for-estat")
            store.save("user1", "datagojp", "key-for-datagojp")
            assert store.get("user1", "estat") == "key-for-estat"
            assert store.get("user1", "datagojp") == "key-for-datagojp"

    def test_異なるuser_idは独立する(self, store, dynamodb_table):
        """同一 source_id でも user_id が異なればキーは独立する（ユーザー分離）。"""
        with mock_aws():
            store.save("user1", "estat", "key-user1")
            store.save("user2", "estat", "key-user2")
            assert store.get("user1", "estat") == "key-user1"
            assert store.get("user2", "estat") == "key-user2"

    def test_上書き保存で新しいキーが返る(self, store, dynamodb_table):
        """同じ (user_id, source_id) への再 save は最新キーに上書きされる。"""
        with mock_aws():
            store.save("user1", "estat", "old-key")
            store.save("user1", "estat", "new-key")
            assert store.get("user1", "estat") == "new-key"

    def test_user1のキーはuser2に見えない(self, store, dynamodb_table):
        """user1 のキーは user2 からは取得できない。"""
        with mock_aws():
            store.save("user1", "estat", "secret-key")
            assert store.get("user2", "estat") is None


# ---------------------------------------------------------------------------
# user_id=None の挙動
# ---------------------------------------------------------------------------


class TestUserIdNone:
    """user_id=None の挙動テスト（DynamoDB では None を返す）。"""

    def test_user_id_NoneのgetはNoneを返す(self, store, dynamodb_table):
        """user_id=None の場合、get は常に None を返す（APIキーなし扱い）。"""
        with mock_aws():
            result = store.get(None, "estat")
        assert result is None

    def test_user_id_NoneのsaveはNoneを保存しない(self, store, dynamodb_table):
        """user_id=None の save は DynamoDB に書き込まず、get も None を返す。"""
        with mock_aws():
            store.save(None, "estat", "some-key")
            result = store.get(None, "estat")
        assert result is None

    def test_user_id_Noneのis_configuredはFalseを返す(self, store, dynamodb_table):
        """user_id=None の is_configured は常に False を返す。"""
        with mock_aws():
            result = store.is_configured(None, "estat")
        assert result is False


# ---------------------------------------------------------------------------
# is_configured
# ---------------------------------------------------------------------------


class TestIsConfigured:
    """is_configured の動作テスト。"""

    def test_登録済みキーはTrueを返す(self, store, dynamodb_table):
        """save 済みの (user_id, source_id) に対して is_configured は True。"""
        with mock_aws():
            store.save("user1", "estat", "some-key")
            assert store.is_configured("user1", "estat") is True

    def test_未登録キーはFalseを返す(self, store, dynamodb_table):
        """未登録の (user_id, source_id) に対して is_configured は False。"""
        with mock_aws():
            assert store.is_configured("user1", "estat") is False

    def test_別ユーザーのキーはis_configuredに影響しない(self, store, dynamodb_table):
        """user2 のキーは user1 の is_configured に影響しない。"""
        with mock_aws():
            store.save("user2", "estat", "key")
            assert store.is_configured("user1", "estat") is False


# ---------------------------------------------------------------------------
# updated_at フィールド
# ---------------------------------------------------------------------------


class TestUpdatedAt:
    """updated_at が ISO 8601 形式で保存されることを確認するテスト。"""

    def test_updated_atがISO8601形式で保存される(self, dynamodb_table):
        """save 後に DynamoDB を直接読んで updated_at が ISO 8601 形式かを確認する。"""
        with mock_aws():
            store = DynamoDBCredentialStore(
                table_name=dynamodb_table,
                region_name="ap-northeast-1",
            )
            store.save("user1", "estat", "test-key")

            # DynamoDB を直接読んで updated_at を確認
            resource = boto3.resource("dynamodb", region_name="ap-northeast-1")
            table = resource.Table(dynamodb_table)
            item = table.get_item(Key={"user_id": "user1", "source_id": "estat"})
            assert "Item" in item
            updated_at = item["Item"]["updated_at"]
            # ISO 8601 形式: YYYY-MM-DDTHH:MM:SS+HH:MM または Z
            import re
            iso8601_pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
            assert re.match(iso8601_pattern, updated_at), (
                f"updated_at が ISO 8601 形式ではない: {updated_at}"
            )


# ---------------------------------------------------------------------------
# テーブル名設定
# ---------------------------------------------------------------------------


class TestTableNameConfig:
    """テーブル名の設定テスト。"""

    def test_デフォルトテーブル名はopenhub_credentials(self, aws_credentials):
        """引数なしのインスタンス化でデフォルトテーブル名 'openhub-credentials' が使われる。"""
        with mock_aws():
            store = DynamoDBCredentialStore(region_name="ap-northeast-1")
            assert store.table_name == "openhub-credentials"

    def test_カスタムテーブル名を指定できる(self, aws_credentials):
        """table_name 引数でカスタムテーブル名を指定できる。"""
        with mock_aws():
            store = DynamoDBCredentialStore(
                table_name="my-custom-table",
                region_name="ap-northeast-1",
            )
            assert store.table_name == "my-custom-table"

    def test_環境変数でテーブル名を設定できる(self, aws_credentials, monkeypatch):
        """DYNAMODB_TABLE_NAME 環境変数でテーブル名を設定できる。"""
        monkeypatch.setenv("DYNAMODB_TABLE_NAME", "env-table-name")
        with mock_aws():
            store = DynamoDBCredentialStore(region_name="ap-northeast-1")
            assert store.table_name == "env-table-name"


# ---------------------------------------------------------------------------
# エッジケース
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """エッジケースのテスト。"""

    def test_特殊文字を含むapi_keyを保存できる(self, store, dynamodb_table):
        """Unicode・記号を含む api_key でも正しく保存できる。"""
        with mock_aws():
            special_key = "key_with_unicode_\u4e2d\u6587_and_symbols_!@#"
            store.save("user1", "estat", special_key)
            assert store.get("user1", "estat") == special_key

    def test_大量ユーザーのキーが独立して保存される(self, dynamodb_table):
        """10 ユーザー分のキーが全て独立して保存・取得できる。"""
        with mock_aws():
            store = DynamoDBCredentialStore(
                table_name=dynamodb_table,
                region_name="ap-northeast-1",
            )
            users = [(f"user{i}", f"key{i}") for i in range(10)]
            for user_id, key in users:
                store.save(user_id, "estat", key)
            for user_id, key in users:
                assert store.get(user_id, "estat") == key
