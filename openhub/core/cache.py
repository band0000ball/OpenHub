"""
インメモリキャッシュ（TTL付き）

設計方針:
- TTL 経過後は stale data を返さない（None を返す）
- スレッドセーフ（GIL に依存しない threading.Lock 使用）
- ジェネリック型対応
"""

import threading
import time
from typing import Generic, TypeVar

# キャッシュに格納する値の型パラメータ
T = TypeVar("T")


class InMemoryCache(Generic[T]):
    """TTL 付きインメモリキャッシュ。

    TTL 経過後のエントリは取得時に削除される（lazy eviction）。
    スレッドセーフ設計。
    """

    def __init__(self, ttl_seconds: float) -> None:
        """
        Args:
            ttl_seconds: キャッシュの生存時間（秒）。0 以下は即期限切れ。
        """
        self._ttl = ttl_seconds
        # {key: (value, expire_at)} の辞書。イミュータブルな操作を維持するため
        # 書き込みは新しい辞書コピーを作成して置き換える
        self._store: dict[str, tuple[T, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> T | None:
        """キーに対応する値を返す。TTL 経過または未設定の場合は None。

        Args:
            key: キャッシュキー

        Returns:
            キャッシュ値またはNone
        """
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expire_at = entry
            if time.monotonic() >= expire_at:
                # 期限切れエントリを削除（lazy eviction）
                self._store = {k: v for k, v in self._store.items() if k != key}
                return None
            return value

    def set(self, key: str, value: T) -> None:
        """キーと値をキャッシュに設定する。既存エントリは上書きされる。

        Args:
            key: キャッシュキー
            value: 格納する値
        """
        expire_at = time.monotonic() + self._ttl
        with self._lock:
            # 新しい辞書を作成してイミュータブルパターンを維持
            new_store = {**self._store, key: (value, expire_at)}
            self._store = new_store

    def delete(self, key: str) -> None:
        """指定キーのエントリを削除する。存在しない場合は何もしない。

        Args:
            key: 削除するキャッシュキー
        """
        with self._lock:
            if key in self._store:
                self._store = {k: v for k, v in self._store.items() if k != key}

    def clear(self) -> None:
        """全エントリを削除する。"""
        with self._lock:
            self._store = {}
