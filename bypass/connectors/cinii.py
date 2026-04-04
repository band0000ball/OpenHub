"""
CiNii Research OpenSearch API コネクター

エンドポイント: https://cir.nii.ac.jp/opensearch/all
認証方式: 不要
レスポンス形式: JSON-LD
"""

import re
from datetime import datetime, timezone

import httpx

from core.errors import UpstreamRateLimitError, UpstreamTimeoutError
from core.models import DatasetMetadata, DatasetPayload, SearchResult

_BASE_URL = "https://cir.nii.ac.jp/opensearch/all"
_TIMEOUT_SECONDS = 30.0
_MAX_COUNT = 200
_MAX_CREATORS_IN_TAGS = 3

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    """HTML タグを除去する。"""
    return _HTML_TAG_RE.sub("", text).strip()


def _extract_crid(url: str) -> str:
    """CiNii URL から CRID を抽出する。"""
    # https://cir.nii.ac.jp/crid/1362825893369700096 → 1362825893369700096
    return url.rsplit("/", 1)[-1]


class CiNiiConnector:
    """CiNii Research OpenSearch API コネクター。

    DataSourceConnector プロトコルを実装する。認証不要。
    """

    source_id: str = "cinii"
    source_name: str = "CiNii Research"

    def __init__(self) -> None:
        self._api_key: str | None = None

    def initialize(self, api_key: str | None) -> None:
        """API キーを設定する（CiNii は認証不要だが Protocol 準拠のため実装）。"""
        self._api_key = api_key

    def search(self, query: str, filters: dict) -> SearchResult:
        """CiNii Research でキーワード検索する。"""
        limit = min(filters.get("limit", 20), _MAX_COUNT)
        offset = filters.get("offset", 0)

        params = {
            "q": query,
            "count": limit,
            "start": offset + 1,  # CiNii は 1-based
            "format": "json",
        }

        try:
            response = httpx.get(
                _BASE_URL,
                params=params,
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"CiNii API タイムアウト: {exc}") from exc

        _raise_for_upstream_error(response)
        body = response.json()
        return _parse_search_response(body, limit, offset)

    def fetch(self, dataset_id: str, api_key: str | None) -> DatasetPayload:
        """個別論文の JSON-LD メタデータを取得する。"""
        crid = dataset_id.removeprefix("cinii:")

        try:
            response = httpx.get(
                f"https://cir.nii.ac.jp/crid/{crid}.json",
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"CiNii API タイムアウト: {exc}") from exc

        _raise_for_upstream_error(response)

        body = response.json()
        metadata = DatasetMetadata(
            id=dataset_id,
            source_id="cinii",
            title=body.get("title", ""),
            description=_strip_html(body.get("description", "")),
            url=f"https://cir.nii.ac.jp/crid/{crid}",
            tags=_extract_tags(body),
            updated_at=body.get("prism:publicationDate", ""),
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
        raise UpstreamRateLimitError("CiNii API レート制限")
    if response.status_code >= 500:
        raise UpstreamTimeoutError(
            f"CiNii API サーバーエラー: {response.status_code}"
        )


def _extract_tags(item: dict) -> tuple[str, ...]:
    """JSON-LD アイテムから tags を抽出する。dc:subject + dc:type + dc:creator（最大3名）。"""
    tags: list[str] = []

    # dc:subject（キーワード）
    subjects = item.get("dc:subject", [])
    if isinstance(subjects, list):
        tags.extend(subjects)
    elif isinstance(subjects, str):
        tags.append(subjects)

    # dc:type（Article, Book 等）
    dc_type = item.get("dc:type", "")
    if dc_type:
        tags.append(dc_type)

    # dc:creator（著者、最大3名）
    creators = item.get("dc:creator", [])
    if isinstance(creators, list):
        tags.extend(creators[:_MAX_CREATORS_IN_TAGS])
    elif isinstance(creators, str):
        tags.append(creators)

    return tuple(t for t in tags if t)


def _parse_search_response(body: dict, limit: int, offset: int) -> SearchResult:
    """OpenSearch JSON-LD レスポンスを SearchResult に変換する。"""
    total_count = body.get("opensearch:totalResults")
    items_raw = body.get("items", [])

    items: list[DatasetMetadata] = []
    for item in items_raw:
        crid = _extract_crid(item.get("@id", ""))
        url = item.get("link", {}).get("@id", item.get("@id", ""))

        items.append(
            DatasetMetadata(
                id=f"cinii:{crid}",
                source_id="cinii",
                title=item.get("title", ""),
                description=_strip_html(item.get("description", "")),
                url=url,
                tags=_extract_tags(item),
                updated_at=item.get("prism:publicationDate", ""),
            )
        )

    has_next = offset + len(items) < (total_count or 0)

    return SearchResult(
        items=tuple(items),
        total_count=total_count,
        has_next=has_next,
    )
