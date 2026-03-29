"""
APIキー管理

設計方針:
- CredentialStoreProtocol: (user_id, source_id) → api_key のインターフェース
- InMemoryCredentialStore: メモリ内 (デモ互換)
- DynamoDBCredentialStore: DynamoDB 永続化
- get_credential_store(): CREDENTIAL_STORE_BACKEND 環境変数でバックエンドを切り替え

環境変数:
- CREDENTIAL_STORE_BACKEND=memory (デフォルト) → InMemoryCredentialStore
- CREDENTIAL_STORE_BACKEND=dynamodb → DynamoDBCredentialStore
- DYNAMODB_TABLE_NAME: DynamoDB テーブル名 (デフォルト: openhub-credentials)
- AWS_REGION: AWS リージョン (デフォルト: ap-northeast-1)

後方互換性:
- 既存の CredentialStore (set/get/has インターフェース) はそのまま保持する
- _credential_store シングルトンは conftest.py が直接操作するため保持する
"""

import os
import threading
from typing import Protocol


# ---------------------------------------------------------------------------
# Protocol 定義（user_id=None 許容）
# ---------------------------------------------------------------------------


class CredentialStoreProtocol(Protocol):
    """APIキーストアの共通インターフェース。

    user_id=None の場合の挙動はストア実装によって異なる:
    - InMemoryCredentialStore: グローバルキーを参照（デモ互換）
    - DynamoDBCredentialStore: None を返す（APIキーなし扱い）
    """

    def save(self, user_id: str | None, source_id: str, api_key: str) -> None:
        """APIキーを登録または上書きする。"""
        ...

    def get(self, user_id: str | None, source_id: str) -> str | None:
        """登録済み APIキーを取得する。未登録の場合は None。"""
        ...

    def is_configured(self, user_id: str | None, source_id: str) -> bool:
        """指定 (user_id, source_id) の APIキーが登録されているか確認する。"""
        ...


# ---------------------------------------------------------------------------
# 既存互換クラス（後方互換性のために保持）
# ---------------------------------------------------------------------------


class CredentialStore:
    """APIキーをメモリに保持するストア（後方互換性のために保持）。

    source_id → api_key のマッピングを管理する。
    Sprint 3.2 以降は InMemoryCredentialStore を使うことを推奨。

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
            self._keys = {**self._keys, source_id: api_key}

    def get(self, user_id_or_source_id: str | None, source_id: str | None = None) -> str | None:
        """登録済み APIキーを取得する。未登録の場合は None。

        Protocol 互換（2引数版）と後方互換（1引数版）の両方をサポートする。

        呼び出し方:
          - get(source_id)                 → 後方互換（1引数）
          - get(user_id, source_id)        → Protocol 互換（2引数、user_id は無視）

        Args:
            user_id_or_source_id: 1引数の場合は source_id、2引数の場合は user_id（無視）
            source_id: 2引数呼び出し時の source_id

        Returns:
            APIキーまたはNone
        """
        # 2引数版: get(user_id, source_id) → source_id のみ使用
        if source_id is not None:
            actual_source_id = source_id
        else:
            # 1引数版: get(source_id)
            actual_source_id = user_id_or_source_id or ""
        with self._lock:
            return self._keys.get(actual_source_id)

    def has(self, source_id: str) -> bool:
        """指定 source_id の APIキーが登録されているか確認する。

        Args:
            source_id: データソース識別子

        Returns:
            登録済みなら True
        """
        with self._lock:
            return source_id in self._keys

    def save(self, user_id: str | None, source_id: str, api_key: str) -> None:
        """CredentialStoreProtocol 互換の保存メソッド。

        user_id は無視して source_id → api_key のマッピングとして保存する。
        既存の CredentialStore と完全互換（user_id 分離なし）。

        Args:
            user_id: 無視される（後方互換のため受け取るが使わない）
            source_id: データソース識別子
            api_key: APIキー
        """
        self.set(source_id, api_key)

    def is_configured(self, user_id: str | None, source_id: str) -> bool:
        """CredentialStoreProtocol 互換の確認メソッド。

        user_id は無視して source_id の有無のみ確認する。
        既存の CredentialStore と完全互換（user_id 分離なし）。

        Args:
            user_id: 無視される（後方互換のため受け取るが使わない）
            source_id: データソース識別子

        Returns:
            登録済みなら True
        """
        return self.has(source_id)


# ---------------------------------------------------------------------------
# シングルトン（後方互換性 + conftest.py が直接操作するため保持）
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# シングルトン（後方互換性 + conftest.py が直接操作するため保持）
# ---------------------------------------------------------------------------

# 後方互換用シングルトン（conftest.py の dependency_overrides が参照するため保持）
_credential_store = CredentialStore()

# InMemoryCredentialStore のシングルトン（CREDENTIAL_STORE_BACKEND=memory 用）
_memory_store: "InMemoryCredentialStore | None" = None


def get_credential_store() -> CredentialStoreProtocol:
    """CREDENTIAL_STORE_BACKEND に応じた CredentialStore を返す。

    FastAPI の Depends() で使用する。

    環境変数:
        CREDENTIAL_STORE_BACKEND: "memory"（デフォルト）または "dynamodb"
        DYNAMODB_TABLE_NAME: DynamoDB テーブル名（dynamodb バックエンド時）
        AWS_REGION: AWS リージョン（dynamodb バックエンド時）
    """
    backend = os.environ.get("CREDENTIAL_STORE_BACKEND", "memory")
    if backend == "dynamodb":
        from core.credentials_dynamodb import DynamoDBCredentialStore
        return DynamoDBCredentialStore(
            table_name=os.environ.get("DYNAMODB_TABLE_NAME"),
            region_name=os.environ.get("AWS_REGION", "ap-northeast-1"),
        )

    # memory バックエンド: InMemoryCredentialStore のシングルトンを返す
    global _memory_store
    if _memory_store is None:
        from core.credentials_memory import InMemoryCredentialStore
        _memory_store = InMemoryCredentialStore()
    return _memory_store
