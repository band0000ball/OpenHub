"""
cache.py のユニットテスト

テスト対象の振る舞い:
- キャッシュ MISS → None を返す
- キャッシュ SET → GET で値を取得できる
- TTL 経過後は MISS になる（stale data を返さない）
- 別キーは干渉しない
- 上書き可能
"""

import time

import pytest

from core.cache import InMemoryCache


class TestInMemoryCache:
    """InMemoryCache の基本動作テスト。"""

    def test_キャッシュミス時はNoneを返す(self):
        """存在しないキーへのアクセスは None を返す。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=60)
        assert cache.get("missing_key") is None

    def test_setした値をgetで取得できる(self):
        """set した値は get で取り出せる。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=60)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_TTL経過後はNoneを返す(self):
        """TTL 1秒のキャッシュは1秒後に None を返す。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=1)
        cache.set("key1", "value1")
        # TTL 前は取得できる
        assert cache.get("key1") == "value1"
        # TTL 経過をシミュレート
        time.sleep(1.1)
        assert cache.get("key1") is None

    def test_TTL経過後はstaleデータを返さない(self):
        """TTL 経過後は古い値を返さず None を返す（stale-while-revalidate なし）。"""
        cache: InMemoryCache[list] = InMemoryCache(ttl_seconds=1)
        cache.set("data", [1, 2, 3])
        time.sleep(1.1)
        result = cache.get("data")
        assert result is None, "TTL 経過後に stale data を返してはいけない"

    def test_別キーは互いに干渉しない(self):
        """異なるキーのエントリは独立して管理される。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=60)
        cache.set("key_a", "value_a")
        cache.set("key_b", "value_b")
        assert cache.get("key_a") == "value_a"
        assert cache.get("key_b") == "value_b"

    def test_同一キーへの上書きが可能(self):
        """同じキーに set すると値が上書きされる。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=60)
        cache.set("key1", "old_value")
        cache.set("key1", "new_value")
        assert cache.get("key1") == "new_value"

    def test_上書き時にTTLがリセットされる(self):
        """上書き set により TTL がリセットされる。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=2)
        cache.set("key1", "old_value")
        time.sleep(1.0)
        # TTL 残り1秒で上書き
        cache.set("key1", "new_value")
        time.sleep(1.5)
        # 最初の TTL なら期限切れだが、リセット後はまだ有効
        assert cache.get("key1") == "new_value"

    def test_deleteで削除できる(self):
        """delete により指定キーのエントリを削除できる。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=60)
        cache.set("key1", "value1")
        cache.delete("key1")
        assert cache.get("key1") is None

    def test_存在しないキーのdeleteはエラーにならない(self):
        """存在しないキーの delete は例外を発生させない。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=60)
        # 例外が発生しないことを確認
        cache.delete("nonexistent_key")

    def test_clearで全エントリが削除される(self):
        """clear により全エントリが削除される。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=60)
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.clear()
        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_リストや辞書も格納できる(self):
        """任意の型を格納できる（ジェネリック）。"""
        cache: InMemoryCache[list] = InMemoryCache(ttl_seconds=60)
        data = [{"id": 1, "name": "テスト"}]
        cache.set("list_data", data)
        assert cache.get("list_data") == data

    def test_TTLゼロは即期限切れになる(self):
        """TTL=0 のキャッシュは常に期限切れとなる。"""
        cache: InMemoryCache[str] = InMemoryCache(ttl_seconds=0)
        cache.set("key1", "value1")
        assert cache.get("key1") is None
