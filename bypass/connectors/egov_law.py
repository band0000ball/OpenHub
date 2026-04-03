"""
e-Gov 法令 API V2 コネクター

エンドポイント: https://laws.e-gov.go.jp/api/2
認証方式: 不要
レスポンス形式: JSON

検索: GET /keyword — 法令本文のキーワード検索
取得: GET /law_data/{law_id} — 法令全文の取得
"""

import json
from datetime import datetime, timezone

import httpx

from core.connector import DataSourceConnector
from core.errors import (
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)
from core.models import DatasetMetadata, DatasetPayload, SearchResult

_BASE_URL = "https://laws.e-gov.go.jp/api/2"
_TIMEOUT_SECONDS = 30.0


class EGovLawConnector:
    """e-Gov 法令 API V2 コネクター。

    キーワード検索と法令全文取得を提供する。認証不要。
    """

    source_id: str = "egov_law"
    source_name: str = "e-Gov 法令 API"

    def __init__(self) -> None:
        self._api_key: str | None = None

    def initialize(self, api_key: str | None) -> None:
        # e-Gov 法令 API は認証不要。api_key は将来の拡張に備えて保持するが使用しない。
        self._api_key = api_key

    def search(self, query: str, filters: dict) -> SearchResult:
        """キーワードで法令を検索する。"""
        limit = filters.get("limit", 20)
        offset = filters.get("offset", 0)

        params = {
            "keyword": query,
            "limit": limit,
            "offset": offset,
            "response_format": "json",
        }

        try:
            response = httpx.get(
                f"{_BASE_URL}/keyword",
                params=params,
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"e-Gov 法令 API タイムアウト: {exc}") from exc

        _raise_for_upstream_error(response)
        body = response.json()
        return _parse_search_response(body, limit, offset)

    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload:
        """法令全文を取得する。"""
        law_id = dataset_id.removeprefix("egov_law:")

        try:
            response = httpx.get(
                f"{_BASE_URL}/law_data/{law_id}",
                params={"response_format": "json"},
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"e-Gov 法令 API タイムアウト: {exc}") from exc

        _raise_for_upstream_error(response)
        return _parse_fetch_response(dataset_id, response)


def _raise_for_upstream_error(response: httpx.Response) -> None:
    """HTTP ステータスコードに応じてドメイン例外を発生させる。"""
    if response.status_code == 429:
        raise UpstreamRateLimitError("e-Gov 法令 API レート制限")
    if response.status_code >= 500:
        raise UpstreamTimeoutError(
            f"e-Gov 法令 API サーバーエラー: {response.status_code}"
        )


def _parse_search_response(body: dict, limit: int, offset: int) -> SearchResult:
    """キーワード検索レスポンスを SearchResult に変換する。"""
    items_raw = body.get("items", [])
    total_count = body.get("total_count")

    items: list[DatasetMetadata] = []
    for item in items_raw:
        law_info = item.get("law_info", {})
        revision_info = item.get("revision_info", {})

        law_id = law_info.get("law_id", "")
        title = revision_info.get("law_title", "")
        law_num = law_info.get("law_num", "")
        law_type = law_info.get("law_type", "")
        promulgation_date = law_info.get("promulgation_date", "")
        category = revision_info.get("category", "")

        tags = tuple(t for t in (law_type, category) if t)

        items.append(
            DatasetMetadata(
                id=f"egov_law:{law_id}",
                source_id="egov_law",
                title=title,
                description=law_num,
                url=f"https://laws.e-gov.go.jp/law/{law_id}",
                tags=tags,
                updated_at=_normalize_date(promulgation_date),
            )
        )

    has_next = offset + len(items) < (total_count or 0)

    return SearchResult(
        items=tuple(items),
        total_count=total_count,
        has_next=has_next,
    )


def _parse_fetch_response(dataset_id: str, response: httpx.Response) -> DatasetPayload:
    """法令データレスポンスを DatasetPayload に変換する。"""
    body = response.json()
    law_info = body.get("law_info", {})
    revision_info = body.get("revision_info", {})

    law_id = law_info.get("law_id", "")
    title = revision_info.get("law_title", "")
    law_num = law_info.get("law_num", "")
    promulgation_date = law_info.get("promulgation_date", "")
    law_type = law_info.get("law_type", "")
    category = revision_info.get("category", "")

    metadata = DatasetMetadata(
        id=dataset_id,
        source_id="egov_law",
        title=title,
        description=law_num,
        url=f"https://laws.e-gov.go.jp/law/{law_id}",
        tags=tuple(t for t in (law_type, category) if t),
        updated_at=_normalize_date(promulgation_date),
    )

    return DatasetPayload(
        metadata=metadata,
        data=response.content,
        format="json",
        fetched_at=datetime.now(timezone.utc).isoformat(),
        record_count=None,
    )


def _normalize_date(date_str: str) -> str:
    """日付文字列を ISO 8601 形式に正規化する。"""
    if not date_str:
        return ""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%dT00:00:00+09:00")
    except ValueError:
        return date_str
