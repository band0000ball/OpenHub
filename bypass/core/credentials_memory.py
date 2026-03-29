"""
InMemoryCredentialStore — メモリ内 APIキー管理

設計方針:
- (user_id, source_id) をキーとしてAPIキーを管理する
- user_id=None はデモ互換のグローバルキーとして扱う
- スレッドセーフ（ロックあり）
- 永続化なし（プロセス再起動でリセット）
- APIキーをログ・例外メッセージに含めない
"""

import threading


class InMemoryCredentialStore:
    """(user_id, source_id) → api_key をメモリに保持するストア。

    user_id=None はデモ互換のグローバルキーとして扱う。
    異なる user_id のキーは完全に独立する（ユーザー分離）。
    """

    def __init__(self) -> None:
        # キー: (user_id_or_none, source_id) → api_key
        self._keys: dict[tuple[str | None, str], str] = {}
        self._lock = threading.Lock()

    def save(self, user_id: str | None, source_id: str, api_key: str) -> None:
        """APIキーを登録または上書きする。

        Args:
            user_id: ユーザーID。None の場合はグローバルキーとして保存。
            source_id: データソース識別子（例: "estat"）
            api_key: APIキー（ログに出力してはいけない）
        """
        with self._lock:
            # イミュータブルパターン: 新しい辞書を作成して置き換える
            self._keys = {**self._keys, (user_id, source_id): api_key}

    def get(self, user_id: str | None, source_id: str) -> str | None:
        """登録済み APIキーを取得する。未登録の場合は None。

        Args:
            user_id: ユーザーID。None の場合はグローバルキーを参照。
            source_id: データソース識別子

        Returns:
            APIキーまたは None
        """
        with self._lock:
            return self._keys.get((user_id, source_id))

    def is_configured(self, user_id: str | None, source_id: str) -> bool:
        """指定 (user_id, source_id) の APIキーが登録されているか確認する。

        Args:
            user_id: ユーザーID。None の場合はグローバルキーを確認。
            source_id: データソース識別子

        Returns:
            登録済みなら True
        """
        with self._lock:
            return (user_id, source_id) in self._keys
