"""
ドメインモデル定義

DatasetMetadata  : データセットのメタ情報
DatasetPayload   : データセット本体（バイナリまたはテキスト）
"""

from dataclasses import dataclass, field
from typing import Literal


# ---------------------------------------------------------------------------
# データセットメタデータ
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DatasetMetadata:
    """データセットのメタ情報。

    id は "{source_id}:{original_id}" の形式で一意性を保証する。
    frozen=True によりイミュータブルを強制する。
    """

    id: str           # "{source_id}:{original_id}"
    source_id: str    # 例: "estat", "datagojp"
    title: str        # データセット名
    description: str  # 概要・説明
    url: str          # 元データURL
    tags: tuple[str, ...]  # タグ一覧
    updated_at: str   # ISO 8601 形式の最終更新日時


# ---------------------------------------------------------------------------
# データセットペイロード
# ---------------------------------------------------------------------------

# サポートするフォーマット一覧
DataFormat = Literal["csv", "json", "geojson", "shapefile", "xml", "binary", "other"]


@dataclass(frozen=True)
class DatasetPayload:
    """データセット本体。

    data は生バイトまたはテキスト文字列。
    frozen=True によりイミュータブルを強制する。
    """

    metadata: DatasetMetadata
    data: bytes | str
    format: DataFormat
    fetched_at: str          # ISO 8601 形式の取得日時
    record_count: int | None  # レコード数（不明な場合は None）
