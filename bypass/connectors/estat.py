"""
e-Stat（政府統計の総合窓口）コネクター

エンドポイント: https://api.e-stat.go.jp/rest/3.0/
認証方式: APIキー必須（クエリパラメータ appId）
レスポンス形式: JSON
"""

import json
from datetime import datetime, timezone

import httpx

from core.connector import DataSourceConnector
from core.errors import (
    AuthenticationError,
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)
from core.models import DatasetMetadata, DatasetPayload, SearchResult

# e-Stat API ベース URL
_BASE_URL = "https://api.e-stat.go.jp/rest/3.0/app/json"

# 上流リクエストのタイムアウト（秒）
_TIMEOUT_SECONDS = 30.0


class EStatConnector:
    """e-Stat API コネクター。

    DataSourceConnector プロトコルを実装する。
    """

    source_id: str = "estat"
    source_name: str = "e-Stat 政府統計の総合窓口"

    def __init__(self) -> None:
        self._api_key: str | None = None

    def initialize(self, api_key: str | None) -> None:
        """APIキーを設定する。

        Args:
            api_key: e-Stat APIキー。None の場合は未設定のまま。
        """
        self._api_key = api_key

    def search(self, query: str, filters: dict) -> SearchResult:
        """e-Stat API で統計表情報を検索する。

        Args:
            query: 検索キーワード
            filters: limit, offset 等のフィルター辞書

        Returns:
            SearchResult（items + ページネーション情報）

        Raises:
            AuthenticationError: APIキー未設定または認証失敗
            UpstreamTimeoutError: タイムアウト
            UpstreamRateLimitError: レート制限
        """
        if not self._api_key:
            raise AuthenticationError(
                "e-Stat の検索には APIキーが必要です。"
                "POST /auth/credentials で estat の APIキーを設定してください。"
            )

        limit = filters.get("limit", 20)
        offset = filters.get("offset", 0)

        params = {
            "appId": self._api_key,
            "searchWord": query,
            "limit": limit,
            "startPosition": offset + 1,  # e-Stat は 1-based
            "lang": "J",
        }

        try:
            with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
                response = client.get(f"{_BASE_URL}/getStatsList", params=params)
        except httpx.TimeoutException:
            raise UpstreamTimeoutError(
                "e-Stat API がタイムアウトしました。"
            ) from None

        _raise_for_upstream_error(response)

        return _parse_search_response(response.json(), limit=limit, offset=offset)

    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload:
        """e-Stat API からデータセット本体を取得する。

        Args:
            dataset_id: "estat:{statsDataId}" 形式の ID
            api_key: 認証キー。None の場合は AuthenticationError。

        Returns:
            DatasetPayload

        Raises:
            AuthenticationError: APIキー未設定
            UpstreamTimeoutError: タイムアウト
            UpstreamRateLimitError: レート制限
        """
        effective_key = api_key or self._api_key
        if not effective_key:
            raise AuthenticationError(
                "e-Stat のデータ取得には APIキーが必要です。"
            )

        # "estat:{original_id}" → "{original_id}" に変換
        original_id = dataset_id.removeprefix("estat:")

        params = {
            "appId": effective_key,
            "statsDataId": original_id,
            "metaGetFlg": "Y",
            "cntGetFlg": "Y",
        }

        try:
            with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
                response = client.get(f"{_BASE_URL}/getStatsData", params=params)
        except httpx.TimeoutException:
            raise UpstreamTimeoutError(
                "e-Stat API がタイムアウトしました。"
            ) from None

        _raise_for_upstream_error(response)

        return _parse_fetch_response(dataset_id, response)


# ---------------------------------------------------------------------------
# プライベートヘルパー関数
# ---------------------------------------------------------------------------

def _raise_for_upstream_error(response: httpx.Response) -> None:
    """HTTP ステータスコードに応じたドメイン例外を発生させる。"""
    if response.status_code == 403:
        raise AuthenticationError("e-Stat API の認証に失敗しました。APIキーを確認してください。")
    if response.status_code == 429:
        raise UpstreamRateLimitError("e-Stat API のレート制限に達しました。")
    if response.status_code >= 500:
        raise UpstreamTimeoutError(
            f"e-Stat API がサーバーエラーを返しました (HTTP {response.status_code})。"
        )


def _parse_search_response(body: dict, limit: int = 20, offset: int = 0) -> SearchResult:
    """e-Stat 検索レスポンスを SearchResult に変換する。"""
    try:
        datalist = body["GET_STATS_LIST"]["DATALIST_INF"]
        table_inf = datalist.get("TABLE_INF", [])
        total_count_raw = datalist.get("NUMBER")
    except (KeyError, TypeError):
        return SearchResult(items=(), total_count=None, has_next=False)

    # 単一結果の場合 dict になるので list に統一
    if isinstance(table_inf, dict):
        table_inf = [table_inf]

    results = []
    for item in table_inf:
        stat_id = item.get("@id", "")
        title_obj = item.get("TITLE", {})
        title = title_obj.get("$", "") if isinstance(title_obj, dict) else str(title_obj)
        gov_org = item.get("GOV_ORG", {})
        org_name = gov_org.get("$", "") if isinstance(gov_org, dict) else ""
        updated_date = item.get("UPDATED_DATE", "")

        metadata = DatasetMetadata(
            id=f"estat:{stat_id}",
            source_id="estat",
            title=title,
            description=f"{item.get('STATISTICS_NAME', '')} - {org_name}",
            url=f"https://www.e-stat.go.jp/dbview?sid={stat_id}",
            tags=_extract_tags(item),
            updated_at=_normalize_date(updated_date),
        )
        results.append(metadata)

    try:
        total_count = int(total_count_raw) if total_count_raw is not None else None
    except (ValueError, TypeError):
        total_count = None

    if total_count is not None:
        has_next = offset + len(results) < total_count
    else:
        has_next = len(results) == limit

    return SearchResult(items=tuple(results), total_count=total_count, has_next=has_next)


def _parse_fetch_response(dataset_id: str, response: httpx.Response) -> DatasetPayload:
    """e-Stat データ取得レスポンスを DatasetPayload に変換する。"""
    body = response.json()
    raw_bytes = response.content

    # テーブル情報からメタデータを抽出
    table_inf = (
        body.get("GET_STATS_DATA", {})
        .get("STATISTICAL_DATA", {})
        .get("TABLE_INF", {})
    )
    title = table_inf.get("TITLE", dataset_id) if isinstance(table_inf, dict) else dataset_id
    updated = table_inf.get("UPDATED_DATE", "") if isinstance(table_inf, dict) else ""
    stat_name = table_inf.get("STATISTICS_NAME", "") if isinstance(table_inf, dict) else ""

    original_id = dataset_id.removeprefix("estat:")

    metadata = DatasetMetadata(
        id=dataset_id,
        source_id="estat",
        title=title,
        description=stat_name,
        url=(
            f"https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"
            f"?statsDataId={original_id}"
        ),
        tags=(),
        updated_at=_normalize_date(updated),
    )

    # レコード数を取得（RESULT_INF.TO_NUMBER）
    result_inf = (
        body.get("GET_STATS_DATA", {})
        .get("STATISTICAL_DATA", {})
        .get("RESULT_INF", {})
    )
    record_count = result_inf.get("TO_NUMBER") if isinstance(result_inf, dict) else None

    return DatasetPayload(
        metadata=metadata,
        data=raw_bytes,
        format="json",
        fetched_at=datetime.now(timezone.utc).isoformat(),
        record_count=record_count,
    )


def _extract_tags(item: dict) -> tuple[str, ...]:
    """統計表情報からタグを抽出する。"""
    tags = []
    for key in ("MAIN_CATEGORY", "SUB_CATEGORY"):
        cat = item.get(key, {})
        if isinstance(cat, dict) and cat.get("$"):
            tags.append(cat["$"])
    return tuple(tags)


def _normalize_date(date_str: str) -> str:
    """日付文字列を ISO 8601 形式に正規化する。"""
    if not date_str:
        return ""
    # "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00+09:00"
    if len(date_str) == 10:
        return f"{date_str}T00:00:00+09:00"
    return date_str
