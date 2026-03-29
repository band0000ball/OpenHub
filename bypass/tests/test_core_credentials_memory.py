"""
InMemoryCredentialStore のユニットテスト（TDD: RED フェーズ）

テスト対象の振る舞い:
- save(user_id, source_id, api_key) でキーを保存する
- get(user_id, source_id) で保存済みキーを返す
- get で未登録の場合 None を返す
- is_configured(user_id, source_id) で登録有無を確認する
- user_id=None の場合はグローバルキーを参照する（デモ互換）
- 異なる user_id のキーは独立する（ユーザー分離）
- 上書き保存が可能
- スレッドセーフ（ロックあり）
"""

import threading

import pytest

from core.credentials_memory import InMemoryCredentialStore


# ---------------------------------------------------------------------------
# save / get の基本動作
# ---------------------------------------------------------------------------


class TestSaveAndGet:
    """save と get の基本動作テスト。"""

    def test_保存したキーをgetで取得できる(self):
        """save した api_key を同じ user_id と source_id で get できる。"""
        store = InMemoryCredentialStore()
        store.save("user1", "estat", "api-key-abc")
        result = store.get("user1", "estat")
        assert result == "api-key-abc"

    def test_未登録のキーはNoneを返す(self):
        """未登録の (user_id, source_id) に対して get は None を返す。"""
        store = InMemoryCredentialStore()
        result = store.get("user1", "estat")
        assert result is None

    def test_異なるsource_idは独立する(self):
        """同一 user_id でも source_id が異なればキーは独立する。"""
        store = InMemoryCredentialStore()
        store.save("user1", "estat", "key-for-estat")
        store.save("user1", "datagojp", "key-for-datagojp")

        assert store.get("user1", "estat") == "key-for-estat"
        assert store.get("user1", "datagojp") == "key-for-datagojp"

    def test_異なるuser_idは独立する(self):
        """同一 source_id でも user_id が異なればキーは独立する（ユーザー分離）。"""
        store = InMemoryCredentialStore()
        store.save("user1", "estat", "key-user1")
        store.save("user2", "estat", "key-user2")

        assert store.get("user1", "estat") == "key-user1"
        assert store.get("user2", "estat") == "key-user2"

    def test_上書き保存で新しいキーが返る(self):
        """同じ (user_id, source_id) への再 save は最新キーに上書きされる。"""
        store = InMemoryCredentialStore()
        store.save("user1", "estat", "old-key")
        store.save("user1", "estat", "new-key")
        assert store.get("user1", "estat") == "new-key"

    def test_user1のキーはuser2に見えない(self):
        """user1 のキーは user2 からは取得できない。"""
        store = InMemoryCredentialStore()
        store.save("user1", "estat", "secret-key")
        assert store.get("user2", "estat") is None


# ---------------------------------------------------------------------------
# user_id=None のグローバルキー互換
# ---------------------------------------------------------------------------


class TestUserIdNoneGlobalKey:
    """user_id=None のデモ互換動作テスト。"""

    def test_user_id_Noneでグローバルキーを保存できる(self):
        """user_id=None で save したキーを get(None, source_id) で取得できる。"""
        store = InMemoryCredentialStore()
        store.save(None, "estat", "global-key")
        result = store.get(None, "estat")
        assert result == "global-key"

    def test_user_id_Noneのキーは認証ユーザーとは独立する(self):
        """user_id=None のグローバルキーと user_id='user1' のキーは独立する。"""
        store = InMemoryCredentialStore()
        store.save(None, "estat", "global-key")
        store.save("user1", "estat", "user-key")

        assert store.get(None, "estat") == "global-key"
        assert store.get("user1", "estat") == "user-key"

    def test_user_id_Noneで未登録はNoneを返す(self):
        """user_id=None でも未登録のキーは None を返す。"""
        store = InMemoryCredentialStore()
        result = store.get(None, "estat")
        assert result is None


# ---------------------------------------------------------------------------
# is_configured
# ---------------------------------------------------------------------------


class TestIsConfigured:
    """is_configured の動作テスト。"""

    def test_登録済みキーはTrueを返す(self):
        """save 済みの (user_id, source_id) に対して is_configured は True。"""
        store = InMemoryCredentialStore()
        store.save("user1", "estat", "some-key")
        assert store.is_configured("user1", "estat") is True

    def test_未登録キーはFalseを返す(self):
        """未登録の (user_id, source_id) に対して is_configured は False。"""
        store = InMemoryCredentialStore()
        assert store.is_configured("user1", "estat") is False

    def test_user_id_Noneで登録済みはTrueを返す(self):
        """user_id=None で save 済みの source_id に対して is_configured は True。"""
        store = InMemoryCredentialStore()
        store.save(None, "estat", "global-key")
        assert store.is_configured(None, "estat") is True

    def test_user_id_Noneで未登録はFalseを返す(self):
        """user_id=None で未登録の source_id に対して is_configured は False。"""
        store = InMemoryCredentialStore()
        assert store.is_configured(None, "estat") is False

    def test_別ユーザーのキーはis_configuredに影響しない(self):
        """user2 のキーは user1 の is_configured に影響しない。"""
        store = InMemoryCredentialStore()
        store.save("user2", "estat", "key")
        assert store.is_configured("user1", "estat") is False


# ---------------------------------------------------------------------------
# 空文字・境界値
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """エッジケースのテスト。"""

    def test_空文字のapi_keyも保存できる(self):
        """api_key が空文字でも save/get できる（バリデーションは API 層の責務）。"""
        store = InMemoryCredentialStore()
        store.save("user1", "estat", "")
        assert store.get("user1", "estat") == ""

    def test_長いapi_keyも保存できる(self):
        """非常に長い api_key でも正しく保存・取得できる。"""
        store = InMemoryCredentialStore()
        long_key = "x" * 10_000
        store.save("user1", "estat", long_key)
        assert store.get("user1", "estat") == long_key

    def test_特殊文字を含むapi_keyを保存できる(self):
        """Unicode・記号・SQL 文字を含む api_key でも正しく保存できる。"""
        store = InMemoryCredentialStore()
        special_key = "'; DROP TABLE users; --\u4e2d\u6587\U0001f600"
        store.save("user1", "estat", special_key)
        assert store.get("user1", "estat") == special_key

    def test_複数のsource_idに複数のuser_idで独立保存(self):
        """(user_id, source_id) の組み合わせが全て独立して保存される。"""
        store = InMemoryCredentialStore()
        combinations = [
            ("u1", "estat", "k11"),
            ("u1", "datagojp", "k12"),
            ("u2", "estat", "k21"),
            ("u2", "datagojp", "k22"),
        ]
        for user_id, source_id, key in combinations:
            store.save(user_id, source_id, key)

        for user_id, source_id, key in combinations:
            assert store.get(user_id, source_id) == key


# ---------------------------------------------------------------------------
# スレッドセーフ
# ---------------------------------------------------------------------------


class TestThreadSafety:
    """並行 save が競合しないことを確認するテスト。"""

    def test_並行saveが全て正常に保存される(self):
        """複数スレッドから同時に save しても全て正常に保存される。"""
        store = InMemoryCredentialStore()
        errors = []

        def save_key(user_id: str, key: str):
            try:
                store.save(user_id, "estat", key)
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        threads = [
            threading.Thread(target=save_key, args=(f"user{i}", f"key{i}"))
            for i in range(50)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        # 全ユーザーのキーが保存されているはず
        for i in range(50):
            assert store.get(f"user{i}", "estat") == f"key{i}"
