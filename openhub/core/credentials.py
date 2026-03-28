"""
APIキー管理（インメモリ）

設計方針:
- 永続化なし（プロセス再起動でリセット）
- 上書き許可（最後に登録したキーが有効）
- APIキーをログ・例外メッセージに含めない
- スレッドセーフ
"""

import threading


class CredentialStore:
    """APIキーをメモリに保持するストア。

    source_id → api_key のマッピングを管理する。
    シングルトンとして使用する。
    """

    def __init__(self) -> None:
        self._keys: dict[str, str] = {}
        self._lock = threading.Lock()

    def set(self, source_id: str, api_key: str) -> None:
        """APIキーを登録または上書きする。

        Args:
            source_id: データソース識別子（例: "estat"）
            api_key: APIキー（ログに出力してはいけない）
        """
        with self._lock:
            # イミュータブルパターン: 新しい辞書を作成して置き換える
            self._keys = {**self._keys, source_id: api_key}

    def get(self, source_id: str) -> str | None:
        """登録済み APIキーを取得する。未登録の場合は None。

        Args:
            source_id: データソース識別子

        Returns:
            APIキーまたはNone
        """
        with self._lock:
            return self._keys.get(source_id)

    def has(self, source_id: str) -> bool:
        """指定 source_id の APIキーが登録されているか確認する。

        Args:
            source_id: データソース識別子

        Returns:
            登録済みなら True
        """
        with self._lock:
            return source_id in self._keys


# アプリケーション全体で共有するシングルトンインスタンス
# 注意: このインスタンスはプロセス内でのみ共有される。
# uvicorn を複数ワーカーで起動した場合、ワーカー間でキーは共有されない。
# Phase 1 はシングルワーカー（uvicorn --workers 1）専用。
_credential_store = CredentialStore()


def get_credential_store() -> CredentialStore:
    """アプリケーション共有の CredentialStore を返す。

    FastAPI の Depends() で使用する。
    """
    return _credential_store
