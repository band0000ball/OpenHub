"""
data.go.jp（政府オープンデータ）コネクター

エンドポイント: https://data.e-gov.go.jp/data/api/3/action/
認証方式: 不要（CKAN API）
レスポンス形式: JSON

注意: 旧エンドポイント（www.data.go.jp）は data.e-gov.go.jp に移転済み。
      移転後のパスは /data/api/3/action/（/api/3/action/ ではない）。
"""

from datetime import datetime, timezone

import httpx

from core.connector import DataSourceConnector
from core.errors import (
    UpstreamRateLimitError,
    UpstreamTimeoutError,
)
from core.models import DatasetMetadata, DatasetPayload, SearchResult

# data.go.jp CKAN API ベース URL（data.e-gov.go.jp に移転済み）
_BASE_URL = "https://data.e-gov.go.jp/data/api/3/action"

# 上流リクエストのタイムアウト（秒）
_TIMEOUT_SECONDS = 30.0


class DataGoJpConnector:
    """data.go.jp CKAN API コネクター。

    DataSourceConnector プロトコルを実装する。
    無認証で動作するため api_key は常に無視される。
    """

    source_id: str = "datagojp"
    source_name: str = "data.go.jp 政府オープンデータ"

    def __init__(self) -> None:
        # data.go.jp は無認証。api_key は将来の拡張用に保持するが使用しない。
        self._api_key: str | None = None

    def initialize(self, api_key: str | None) -> None:
        """コネクターを初期化する。

        data.go.jp は無認証のため api_key は使用しない。

        Args:
            api_key: 無視される（将来の拡張用）
        """
        self._api_key = api_key  # 将来の拡張に備えて保持

    def search(self, query: str, filters: dict) -> SearchResult:
        """data.go.jp CKAN API でデータセットを検索する。

        Args:
            query: 検索キーワード
            filters: limit, offset 等のフィルター辞書

        Returns:
            SearchResult（items + ページネーション情報）

        Raises:
            UpstreamTimeoutError: タイムアウト
            UpstreamRateLimitError: レート制限
        """
        limit = filters.get("limit", 20)
        offset = filters.get("offset", 0)

        # CKAN は limit=rows, offset=start
        params = {
            "q": query,
            "rows": limit,
            "start": offset,
        }

        try:
            with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
                response = client.get(f"{_BASE_URL}/package_search", params=params)
        except httpx.TimeoutException:
            raise UpstreamTimeoutError(
                "data.go.jp API がタイムアウトしました。"
            ) from None

        _raise_for_upstream_error(response)

        content_type = response.headers.get("content-type", "")
        if not response.content or "json" not in content_type:
            return SearchResult(items=(), total_count=None, has_next=False)

        return _parse_search_response(response.json(), limit=limit, offset=offset)

    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload:
        """data.go.jp からデータセット情報を取得する。

        Args:
            dataset_id: "datagojp:{original_id}" 形式の ID
            api_key: 無視される（無認証ソース）

        Returns:
            DatasetPayload

        Raises:
            UpstreamTimeoutError: タイムアウト
            UpstreamRateLimitError: レート制限
        """
        # "datagojp:{original_id}" → "{original_id}" に変換
        original_id = dataset_id.removeprefix("datagojp:")

        params = {"id": original_id}

        try:
            with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
                response = client.get(f"{_BASE_URL}/package_show", params=params)
        except httpx.TimeoutException:
            raise UpstreamTimeoutError(
                "data.go.jp API がタイムアウトしました。"
            ) from None

        _raise_for_upstream_error(response)

        return _parse_fetch_response(dataset_id, response)


# ---------------------------------------------------------------------------
# プライベートヘルパー関数
# ---------------------------------------------------------------------------

def _raise_for_upstream_error(response: httpx.Response) -> None:
    """HTTP ステータスコードに応じたドメイン例外を発生させる。"""
    if response.status_code == 429:
        raise UpstreamRateLimitError("data.go.jp API のレート制限に達しました。")
    if response.status_code >= 500:
        raise UpstreamTimeoutError(
            f"data.go.jp API がサーバーエラーを返しました (HTTP {response.status_code})。"
        )


def _parse_search_response(body: dict, limit: int = 20, offset: int = 0) -> SearchResult:
    """CKAN 検索レスポンスを SearchResult に変換する。"""
    try:
        result_block = body["result"]
        packages = result_block["results"]
        total_count_raw = result_block.get("count")
    except (KeyError, TypeError):
        return SearchResult(items=(), total_count=None, has_next=False)

    items = tuple(_ckan_package_to_metadata(pkg) for pkg in packages)
    try:
        total_count = int(total_count_raw) if total_count_raw is not None else None
    except (ValueError, TypeError):
        total_count = None

    if total_count is not None:
        has_next = offset + len(items) < total_count
    else:
        has_next = len(items) == limit

    return SearchResult(items=items, total_count=total_count, has_next=has_next)


def _parse_fetch_response(dataset_id: str, response: httpx.Response) -> DatasetPayload:
    """CKAN package_show レスポンスを DatasetPayload に変換する。

    注意: data フィールドには package_show のレスポンス全体（メタデータ）が入る。
    実データファイルの取得は Phase 2 で resources[].url への別途リクエストとして実装予定。
    """
    content_type = response.headers.get("content-type", "")
    if not response.content or "json" not in content_type:
        pkg: dict = {}
    else:
        body = response.json()
        pkg = body.get("result", {})
    metadata = _ckan_package_to_metadata(pkg, override_id=dataset_id)

    # リソースからフォーマットを推定
    resources: list = pkg.get("resources", [])
    fmt = _infer_format(resources[0].get("format", "") if resources else "")

    return DatasetPayload(
        metadata=metadata,
        data=response.content,
        format=fmt,
        fetched_at=datetime.now(timezone.utc).isoformat(),
        record_count=None,
    )


def _ckan_package_to_metadata(
    pkg: dict,
    override_id: str | None = None,
) -> DatasetMetadata:
    """CKAN パッケージ辞書を DatasetMetadata に変換する。"""
    original_id = pkg.get("id", "")
    dataset_id = override_id or f"datagojp:{original_id}"
    tags = tuple(tag["name"] for tag in pkg.get("tags", []) if "name" in tag)
    updated_at = pkg.get("metadata_modified", "")

    # Web ページ URL: name フィールドがあれば詳細ページ、なければ空
    name = pkg.get("name", "")
    url = f"https://data.e-gov.go.jp/data/dataset/{name}" if name else ""

    return DatasetMetadata(
        id=dataset_id,
        source_id="datagojp",
        title=pkg.get("title") or "",
        description=pkg.get("notes") or "",
        url=url,
        tags=tags,
        updated_at=updated_at or "",
    )


def _infer_format(format_str: str) -> str:
    """リソースのフォーマット文字列から DataFormat に変換する。"""
    mapping = {
        "CSV": "csv",
        "JSON": "json",
        "GEOJSON": "geojson",
        "SHAPEFILE": "shapefile",
        "XML": "xml",
    }
    return mapping.get(format_str.upper(), "other")
