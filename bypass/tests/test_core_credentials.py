"""
CredentialStore（後方互換クラス）の Protocol 互換メソッドと
get_credential_store() ファクトリのテスト。

テスト対象:
- get(user_id, source_id): 2引数版 Protocol 互換パス
- save(user_id, source_id, api_key): Protocol 互換ラッパー
- is_configured(user_id, source_id): Protocol 互換ラッパー
- get_credential_store(): CREDENTIAL_STORE_BACKEND による分岐
"""

from unittest.mock import MagicMock, patch

import pytest

from core.credentials import CredentialStore, get_credential_store


class TestCredentialStoreProtocolCompat:
    """CredentialStore の Protocol 互換メソッドのテスト。"""

    def test_save_はset経由でキーを保存する(self):
        """save(user_id, source_id, api_key) は set(source_id, api_key) に委譲する。"""
        store = CredentialStore()
        store.save("user1", "estat", "my-key")
        assert store.get("estat") == "my-key"

    def test_save_したキーをget_1引数で取得できる(self):
        """save で保存したキーは get(source_id) でも取得できる。"""
        store = CredentialStore()
        store.save(None, "datagojp", "key-abc")
        assert store.get("datagojp") == "key-abc"

    def test_is_configured_は登録済みキーにTrueを返す(self):
        """is_configured(user_id, source_id) は登録済みなら True。"""
        store = CredentialStore()
        store.set("estat", "test-key")
        assert store.is_configured("user1", "estat") is True

    def test_is_configured_は未登録キーにFalseを返す(self):
        """is_configured(user_id, source_id) は未登録なら False。"""
        store = CredentialStore()
        assert store.is_configured("user1", "estat") is False

    def test_is_configured_はuser_id_Noneでも動作する(self):
        """is_configured(None, source_id) でも正しく判定する。"""
        store = CredentialStore()
        store.set("estat", "key")
        assert store.is_configured(None, "estat") is True


class TestCredentialStoreGet2Args:
    """CredentialStore.get の 2 引数（Protocol 互換）パスのテスト。"""

    def test_get_2引数でsource_idのキーを返す(self):
        """get(user_id, source_id) は user_id を無視して source_id のキーを返す。"""
        store = CredentialStore()
        store.set("estat", "api-key-123")
        result = store.get("any-user", "estat")
        assert result == "api-key-123"

    def test_get_2引数で未登録はNoneを返す(self):
        """get(user_id, source_id) で未登録の場合 None を返す。"""
        store = CredentialStore()
        result = store.get("user1", "estat")
        assert result is None

    def test_get_2引数でuser_idがNoneでも動作する(self):
        """get(None, source_id) でも正しくキーを返す。"""
        store = CredentialStore()
        store.set("estat", "key-for-none")
        result = store.get(None, "estat")
        assert result == "key-for-none"


class TestGetCredentialStore:
    """get_credential_store() ファクトリのテスト。"""

    def test_デフォルトはmemoryバックエンドを返す(self):
        """CREDENTIAL_STORE_BACKEND 未設定時は InMemoryCredentialStore を返す。"""
        with patch.dict("os.environ", {}, clear=False):
            # memory_store キャッシュをリセット
            import core.credentials as creds
            creds._memory_store = None
            store = get_credential_store()
            from core.credentials_memory import InMemoryCredentialStore
            assert isinstance(store, InMemoryCredentialStore)

    def test_dynamodbバックエンドを選択できる(self):
        """CREDENTIAL_STORE_BACKEND=dynamodb で DynamoDBCredentialStore を返す。"""
        mock_dynamo_store = MagicMock()
        with patch.dict("os.environ", {"CREDENTIAL_STORE_BACKEND": "dynamodb"}):
            with patch(
                "core.credentials_dynamodb.DynamoDBCredentialStore",
                return_value=mock_dynamo_store,
            ):
                store = get_credential_store()
                assert store is mock_dynamo_store
