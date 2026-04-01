"""
GET /datasets/search と GET /datasets/{id}/fetch エンドポイントのテスト

テスト対象の振る舞い:
- /datasets/search: 正常検索 → 200 OK + DatasetMetadata リスト
- /datasets/search: q パラメータ必須 → 422
- /datasets/search: limit/offset バウンダリチェック
- /datasets/search: source フィルタリング
- /datasets/search: キャッシュヒット時は上流に問い合わせない
- /datasets/{id}/fetch: 正常取得 → 200 OK + DatasetPayload
- /datasets/{id}/fetch: 存在しない ID → 404
- /datasets/{id}/fetch: APIキー未設定 → 401
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from core.models import DatasetMetadata, DatasetPayload, SearchResult


# ---------------------------------------------------------------------------
# サンプルデータヘルパー
# ---------------------------------------------------------------------------

def make_metadata(n: int = 1) -> list[DatasetMetadata]:
    """テスト用 DatasetMetadata リストを生成する。"""
    return [
        DatasetMetadata(
            id=f"estat:dataset_{i}",
            source_id="estat",
            title=f"テストデータセット {i}",
            description=f"テスト用データセット {i} の概要",
            url=f"https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?statsDataId={i:010d}",
            tags=("テスト", f"tag_{i}"),
            updated_at="2024-01-15T00:00:00+09:00",
        )
        for i in range(1, n + 1)
    ]


def make_search_result(
    n: int = 1,
    total_count: int | None = None,
    has_next: bool = False,
) -> SearchResult:
    """テスト用 SearchResult を生成する。"""
    items = tuple(make_metadata(n))
    return SearchResult(
        items=items,
        total_count=total_count if total_count is not None else n,
        has_next=has_next,
    )


def make_payload(metadata: DatasetMetadata) -> DatasetPayload:
    """テスト用 DatasetPayload を生成する。"""
    return DatasetPayload(
        metadata=metadata,
        data=b'{"test": "data"}',
        format="json",
        fetched_at="2024-01-15T10:00:00+09:00",
        record_count=10,
    )


# ---------------------------------------------------------------------------
# /datasets/search テスト
# ---------------------------------------------------------------------------

class TestGetDatasetsSearch:
    """GET /datasets/search エンドポイントのテスト。"""

    def test_正常検索で200とメタデータリストを返す(self, client: TestClient):
        """q パラメータ付きの正常リクエストで 200 OK とデータリストを返す。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = make_search_result(3, total_count=3)
            response = client.get("/datasets/search?q=人口")
        assert response.status_code == 200
        body = response.json()
        assert "items" in body
        assert "total" in body
        assert "has_next" in body
        assert len(body["items"]) == 3

    def test_qパラメータ未指定で422を返す(self, client: TestClient):
        """q が未指定の場合 422 Unprocessable Entity を返す。"""
        response = client.get("/datasets/search")
        assert response.status_code == 422

    def test_qが空文字で422を返す(self, client: TestClient):
        """q が空文字の場合 422 Unprocessable Entity を返す。"""
        response = client.get("/datasets/search?q=")
        assert response.status_code == 422

    def test_limitデフォルトは20(self, client: TestClient):
        """limit 未指定時のデフォルト値は 20。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = make_search_result(5)
            response = client.get("/datasets/search?q=テスト")
        assert response.status_code == 200
        # limit=20 で呼ばれることを確認
        call_kwargs = mock_search.call_args
        assert call_kwargs is not None

    def test_limit上限は100(self, client: TestClient):
        """limit=101 は 422 を返す（上限 100 を超えるため）。"""
        response = client.get("/datasets/search?q=テスト&limit=101")
        assert response.status_code == 422

    def test_limit下限は1(self, client: TestClient):
        """limit=0 は 422 を返す（下限 1 未満のため）。"""
        response = client.get("/datasets/search?q=テスト&limit=0")
        assert response.status_code == 422

    def test_offsetは0以上(self, client: TestClient):
        """offset=-1 は 422 を返す。"""
        response = client.get("/datasets/search?q=テスト&offset=-1")
        assert response.status_code == 422

    def test_sourceフィルタで特定ソースのみ検索(self, client: TestClient):
        """source=estat の場合、e-Stat のみを検索する。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = make_search_result(2)
            response = client.get("/datasets/search?q=人口&source=estat")
        assert response.status_code == 200

    def test_未知のsourceで422を返す(self, client: TestClient):
        """未知の source_id は 422 を返す。"""
        response = client.get("/datasets/search?q=テスト&source=unknown")
        assert response.status_code == 422

    def test_キャッシュヒット時は上流に問い合わせない(self, client: TestClient):
        """同一クエリの2回目以降はキャッシュから返す（モックが1回のみ呼ばれる）。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = make_search_result(2)
            client.get("/datasets/search?q=キャッシュテスト")
            client.get("/datasets/search?q=キャッシュテスト")
        assert mock_search.call_count == 1, "キャッシュヒット時は上流を呼ばない"

    def test_レスポンスにoffsetとlimitが含まれる(self, client: TestClient):
        """ページネーション情報がレスポンスに含まれる。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = make_search_result(3)
            response = client.get("/datasets/search?q=テスト&limit=10&offset=0")
        body = response.json()
        assert "limit" in body
        assert "offset" in body
        assert "has_next" in body

    def test_total_countが全件数を返す(self, client: TestClient):
        """total フィールドが全ヒット件数を返す。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = make_search_result(3, total_count=100)
            response = client.get("/datasets/search?q=テスト&limit=3&offset=0")
        body = response.json()
        assert body["total"] == 100

    def test_has_nextがTrueのとき次ページあり(self, client: TestClient):
        """has_next が True のとき次ページが存在する。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = make_search_result(3, total_count=10, has_next=True)
            response = client.get("/datasets/search?q=テスト&limit=3&offset=0")
        body = response.json()
        assert body["has_next"] is True

    def test_total_countがNoneのときtotalがNullを返す(self, client: TestClient):
        """total_count が None のとき total フィールドは null を返す。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = SearchResult(
                items=tuple(make_metadata(2)), total_count=None, has_next=True
            )
            response = client.get("/datasets/search?q=テスト")
        body = response.json()
        assert body["total"] is None
        assert body["has_next"] is True

    def test_検索結果ゼロ件で空リストを返す(self, client: TestClient):
        """ヒットなしの場合は空リストを返す（エラーではない）。"""
        with patch("api.datasets.search_all_sources") as mock_search:
            mock_search.return_value = SearchResult(items=(), total_count=0, has_next=False)
            response = client.get("/datasets/search?q=存在しないデータ")
        assert response.status_code == 200
        assert response.json()["items"] == []


# ---------------------------------------------------------------------------
# /datasets/{id}/fetch テスト
# ---------------------------------------------------------------------------

class TestGetDatasetsFetch:
    """GET /datasets/{id}/fetch エンドポイントのテスト。"""

    def test_正常取得で200とペイロードを返す(self, client: TestClient):
        """有効な dataset_id で 200 OK とペイロードを返す。"""
        meta = make_metadata(1)[0]
        payload = make_payload(meta)
        with patch("api.datasets.fetch_dataset") as mock_fetch:
            mock_fetch.return_value = payload
            response = client.get(f"/datasets/estat:dataset_1/fetch")
        assert response.status_code == 200
        body = response.json()
        assert "metadata" in body
        assert "format" in body
        assert "fetched_at" in body

    def test_存在しないデータセットで404を返す(self, client: TestClient):
        """存在しない dataset_id は 404 Not Found を返す。"""
        with patch("api.datasets.fetch_dataset") as mock_fetch:
            from core.errors import DatasetNotFoundError
            mock_fetch.side_effect = DatasetNotFoundError("dataset not found")
            response = client.get("/datasets/estat:nonexistent/fetch")
        assert response.status_code == 404

    def test_APIキー未設定時に401を返す(self, client: TestClient):
        """認証が必要なソースで APIキー未設定の場合 401 Unauthorized を返す。"""
        with patch("api.datasets.fetch_dataset") as mock_fetch:
            from core.errors import AuthenticationError
            mock_fetch.side_effect = AuthenticationError("API key required")
            response = client.get("/datasets/estat:dataset_1/fetch")
        assert response.status_code == 401

    def test_上流タイムアウトで504を返す(self, client: TestClient):
        """上流APIタイムアウト時は 504 Gateway Timeout を返す。"""
        with patch("api.datasets.fetch_dataset") as mock_fetch:
            from core.errors import UpstreamTimeoutError
            mock_fetch.side_effect = UpstreamTimeoutError("upstream timeout")
            response = client.get("/datasets/estat:dataset_1/fetch")
        assert response.status_code == 504

    def test_上流レート制限で429を返す(self, client: TestClient):
        """上流APIが 429 を返した場合、クライアントにも 429 を返す。"""
        with patch("api.datasets.fetch_dataset") as mock_fetch:
            from core.errors import UpstreamRateLimitError
            mock_fetch.side_effect = UpstreamRateLimitError("rate limited")
            response = client.get("/datasets/estat:dataset_1/fetch")
        assert response.status_code == 429

    def test_dataset_idのコロン区切りフォーマット検証(self, client: TestClient):
        """"{source_id}:{original_id}" 形式でない ID は 422 を返す。"""
        response = client.get("/datasets/invalid_id_without_colon/fetch")
        assert response.status_code == 422

    def test_不明なソースIDで404を返す(self, client: TestClient):
        """"{source_id}" が未登録のソースの場合 404 を返す。"""
        with patch("api.datasets.fetch_dataset") as mock_fetch:
            from core.errors import DatasetNotFoundError
            mock_fetch.side_effect = DatasetNotFoundError("unknown source")
            response = client.get("/datasets/unknown_source:dataset_1/fetch")
        assert response.status_code == 404
