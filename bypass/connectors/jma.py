"""
JMA（気象庁）コネクター — メタデータカタログ方式

エンドポイント: https://www.jma.go.jp/bosai/ （非公式 JSON）
認証方式: 不要
レスポンス形式: JSON

メタデータカタログ方式:
- 静的 JSON（jma_catalog.json）にデータセット一覧を保持
- search(): カタログ内をキーワードマッチ（API 呼び出しなし）
- fetch(): 実エンドポイントを呼び出してデータ取得

対応データ:
- 天気予報（58 地域）: /forecast/data/overview_forecast/{code}.json
- 気象警報（58 地域）: /warning/data/warning/{code}.json
- 地震情報（最新一覧）: /quake/data/list.json
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

from core.connector import DataSourceConnector
from core.errors import (
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)
from core.models import DatasetMetadata, DatasetPayload, SearchResult

_TIMEOUT_SECONDS = 15.0
_CATALOG_PATH = Path(__file__).parent / "jma_catalog.json"


def _load_catalog() -> list[dict]:
    """静的カタログ JSON を読み込む。"""
    return json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))


class JmaConnector:
    """気象庁データコネクター（メタデータカタログ方式）。"""

    source_id: str = "jma"
    source_name: str = "気象庁"

    def __init__(self) -> None:
        self._api_key: str | None = None
        self._catalog: list[dict] = _load_catalog()

    def initialize(self, api_key: str | None) -> None:
        # 気象庁は認証不要
        self._api_key = api_key

    def search(self, query: str, filters: dict) -> SearchResult:
        """カタログ内をキーワードマッチで検索する。API 呼び出しなし。"""
        limit = filters.get("limit", 20)
        offset = filters.get("offset", 0)

        keywords = query.lower().split()
        matched = [
            entry for entry in self._catalog
            if _matches(entry, keywords)
        ]

        total_count = len(matched)
        page = matched[offset:offset + limit]
        has_next = offset + len(page) < total_count

        items = tuple(
            DatasetMetadata(
                id=entry["id"],
                source_id="jma",
                title=entry["title"],
                description=entry["description"],
                url=entry["url"],
                tags=tuple(entry.get("tags", [])),
                updated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
            )
            for entry in page
        )

        return SearchResult(items=items, total_count=total_count, has_next=has_next)

    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload:
        """カタログからエンドポイント URL を取得し、実データを取得する。"""
        entry = _find_entry(self._catalog, dataset_id)
        if entry is None:
            raise UpstreamTimeoutError(f"データセットが見つかりません: {dataset_id}")

        endpoint = entry["endpoint"]

        try:
            response = httpx.get(endpoint, timeout=_TIMEOUT_SECONDS)
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"気象庁 API タイムアウト: {exc}") from exc

        _raise_for_upstream_error(response)

        metadata = DatasetMetadata(
            id=dataset_id,
            source_id="jma",
            title=entry["title"],
            description=entry["description"],
            url=entry["url"],
            tags=tuple(entry.get("tags", [])),
            updated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        )

        return DatasetPayload(
            metadata=metadata,
            data=response.content,
            format="json",
            fetched_at=datetime.now(timezone.utc).isoformat(),
            record_count=None,
        )


def _matches(entry: dict, keywords: list[str]) -> bool:
    """エントリがキーワードに全てマッチするか判定する。"""
    searchable = " ".join([
        entry.get("title", ""),
        entry.get("description", ""),
        " ".join(entry.get("tags", [])),
    ]).lower()
    return all(kw in searchable for kw in keywords)


def _find_entry(catalog: list[dict], dataset_id: str) -> dict | None:
    """カタログから dataset_id に一致するエントリを返す。"""
    for entry in catalog:
        if entry["id"] == dataset_id:
            return entry
    return None


def _raise_for_upstream_error(response: httpx.Response) -> None:
    """HTTP ステータスコードに応じてドメイン例外を発生させる。"""
    if response.status_code == 429:
        raise UpstreamRateLimitError("気象庁 API レート制限")
    if response.status_code >= 500:
        raise UpstreamTimeoutError(
            f"気象庁 API サーバーエラー: {response.status_code}"
        )
