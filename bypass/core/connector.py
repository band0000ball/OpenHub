"""
DataSourceConnector プロトコル定義

各データソースコネクター（e-Stat, data.go.jp 等）が実装すべき
インターフェースを Protocol として定義する。
"""

from typing import Protocol, runtime_checkable

from .models import DatasetMetadata, DatasetPayload, SearchResult


@runtime_checkable
class DataSourceConnector(Protocol):
    """データソースコネクタープロトコル。

    runtime_checkable により isinstance() でのチェックが可能。
    各実装クラスはこのプロトコルを満たす必要がある。
    """

    # データソースの識別子（例: "estat", "datagojp"）
    source_id: str

    # データソースの表示名（例: "e-Stat 政府統計の総合窓口"）
    source_name: str

    def initialize(self, api_key: str | None) -> None:
        """APIキーを設定してコネクターを初期化する。

        api_key が None の場合は無認証で動作する。
        """
        ...

    def search(self, query: str, filters: dict) -> SearchResult:
        """クエリとフィルターでデータセットを検索する。

        Args:
            query: 検索キーワード
            filters: source, limit, offset 等のフィルター辞書

        Returns:
            SearchResult（items + ページネーション情報）
        """
        ...

    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload:
        """データセット本体を取得する。

        Args:
            dataset_id: "{source_id}:{original_id}" 形式の ID
            api_key: 認証が必要なソースに渡す APIキー

        Returns:
            データセットペイロード
        """
        ...
