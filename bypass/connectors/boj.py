"""
BOJ 日銀統計 API コネクター

エンドポイント: https://www.stat-search.boj.or.jp/api/v1
認証方式: 不要
レスポンス形式: JSON

/getMetadata で系列メタデータを取得し、DatasetMetadata にマッピングする。
"""

from datetime import datetime, timezone

import httpx

from core.errors import UpstreamRateLimitError, UpstreamTimeoutError
from core.models import DatasetMetadata, DatasetPayload, SearchResult

_BASE_URL = "https://www.stat-search.boj.or.jp/api/v1"
_TIMEOUT_SECONDS = 30.0

# stat-search の Web 閲覧ページ URL テンプレート
_WEB_URL_TEMPLATE = (
    "https://www.stat-search.boj.or.jp/ssi/cgi-bin/famecgi2"
    "?cgi=$nme_a000&lstid={code}&optid1=nme_a001_JP"
)


class BojConnector:
    """BOJ 日銀統計 API コネクター。

    DataSourceConnector プロトコルを実装する。認証不要。
    """

    source_id: str = "boj"
    source_name: str = "日本銀行 時系列統計データ"

    def __init__(self) -> None:
        self._api_key: str | None = None

    def initialize(self, api_key: str | None) -> None:
        """API キーを設定する（BOJ は認証不要だが Protocol 準拠のため実装）。"""
        self._api_key = api_key

    def search(self, query: str, filters: dict) -> SearchResult:
        """BOJ API でメタデータを検索する。"""
        params: dict = {
            "format": "json",
            "lang": "JP",
        }
        if query:
            params["keyword"] = query

        # db フィルタがあれば適用（Collector から DB ID を指定する場合）
        db = filters.get("db")
        if db:
            params["db"] = db

        try:
            response = httpx.get(
                f"{_BASE_URL}/getMetadata",
                params=params,
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"BOJ API タイムアウト: {exc}") from exc

        _raise_for_upstream_error(response)
        body = response.json()
        return _parse_metadata_response(body)

    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload:
        """個別系列のメタデータを取得する。"""
        code = dataset_id.removeprefix("boj:")

        params = {
            "code": code,
            "format": "json",
            "lang": "JP",
        }

        try:
            response = httpx.get(
                f"{_BASE_URL}/getMetadata",
                params=params,
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"BOJ API タイムアウト: {exc}") from exc

        _raise_for_upstream_error(response)
        body = response.json()
        result = _parse_metadata_response(body)

        if result.items:
            metadata = result.items[0]
        else:
            metadata = DatasetMetadata(
                id=dataset_id,
                source_id="boj",
                title=code,
                description="",
                url=_WEB_URL_TEMPLATE.format(code=code),
                tags=(),
                updated_at="",
            )

        return DatasetPayload(
            metadata=metadata,
            data=response.text,
            format="json",
            fetched_at=datetime.now(timezone.utc).isoformat(),
            record_count=None,
        )


def _raise_for_upstream_error(response: httpx.Response) -> None:
    """HTTP ステータスコードに応じて例外を発生させる。"""
    if response.status_code == 429:
        raise UpstreamRateLimitError("BOJ API レート制限")
    if response.status_code >= 500:
        raise UpstreamTimeoutError(
            f"BOJ API サーバーエラー: {response.status_code}"
        )


def _normalize_date(date_str: str) -> str:
    """YYYYMMDD を ISO 8601 に変換する。"""
    if not date_str or len(date_str) != 8:
        return date_str
    return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}T00:00:00+09:00"


def _parse_metadata_response(body: dict) -> SearchResult:
    """getMetadata レスポンスを SearchResult に変換する。"""
    result_set = body.get("RESULTSET", [])

    items: list[DatasetMetadata] = []
    for entry in result_set:
        code = entry.get("SERIES_CODE", "")
        if not code:
            # ヘッダー行（SERIES_CODE 空）はスキップ
            continue

        name_j = entry.get("NAME_OF_TIME_SERIES_J", "")
        category_j = entry.get("CATEGORY_J", "")
        unit_j = entry.get("UNIT_J", "")
        frequency = entry.get("FREQUENCY", "")
        last_update = entry.get("LAST_UPDATE", "")
        notes_j = entry.get("NOTES_J", "")

        description_parts = [p for p in (category_j, unit_j, notes_j) if p]
        description = " / ".join(description_parts) if description_parts else ""

        tags: list[str] = []
        if category_j:
            tags.append(category_j)
        if frequency:
            tags.append(frequency)

        items.append(
            DatasetMetadata(
                id=f"boj:{code}",
                source_id="boj",
                title=name_j,
                description=description,
                url=_WEB_URL_TEMPLATE.format(code=code),
                tags=tuple(tags),
                updated_at=_normalize_date(last_update),
            )
        )

    return SearchResult(
        items=tuple(items),
        total_count=len(items),
        has_next=False,
    )
