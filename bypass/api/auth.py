"""
POST /auth/credentials エンドポイント

設計方針:
- APIキーはメモリのみに保持（永続化なし）
- 同一 source_id への再登録は上書き許可
- APIキーをレスポンスに含めない（情報漏洩防止）
- 未知の source_id には 404 を返す
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.datasets import get_search_cache
from core.auth import get_current_user
from core.credentials import CredentialStore, CredentialStoreProtocol, get_credential_store

router = APIRouter(prefix="/auth", tags=["認証"])

# 登録可能なソース ID の一覧（変更時はここに追加する）
VALID_SOURCE_IDS = frozenset(["estat", "datagojp"])


class CredentialsRequest(BaseModel):
    """POST /auth/credentials リクエストボディ。"""

    source_id: str = Field(
        ...,
        description="データソース識別子（例: 'estat', 'datagojp'）",
    )
    api_key: str = Field(
        ...,
        min_length=1,
        description="APIキー（1文字以上）",
    )


class CredentialsResponse(BaseModel):
    """POST /auth/credentials レスポンスボディ。

    セキュリティ上、api_key はレスポンスに含めない。
    """

    source_id: str
    message: str


class CredentialStatusResponse(BaseModel):
    """GET /auth/credentials/{source_id}/status レスポンスボディ。"""

    source_id: str
    configured: bool


@router.post(
    "/credentials",
    response_model=CredentialsResponse,
    status_code=status.HTTP_200_OK,
    summary="APIキーを設定する",
    description=(
        "指定したデータソースの APIキーをメモリに保存します。"
        "同一 source_id への再登録は上書きされます。"
        "APIキーは永続化されず、プロセス再起動でリセットされます。"
    ),
)
def post_credentials(
    body: CredentialsRequest,
    user_id: str = Depends(get_current_user),
    store: CredentialStore = Depends(get_credential_store),
) -> CredentialsResponse:
    """APIキーを登録する。

    Args:
        body: リクエストボディ
        user_id: 認証済みユーザーID
        store: 依存注入された CredentialStore

    Returns:
        CredentialsResponse（api_key は含まない）

    Raises:
        HTTPException 404: 未知の source_id
    """
    if body.source_id not in VALID_SOURCE_IDS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"データソース '{body.source_id}' は登録されていません。"
            f"利用可能なソース: {sorted(VALID_SOURCE_IDS)}",
        )

    # APIキーを保存（api_key の値はログに出力しない）
    store.save(user_id, body.source_id, body.api_key)

    # APIキー変更後は検索キャッシュを全クリアする
    # （古いキャッシュに空の検索結果が残り、新しいキーが反映されないのを防ぐ）
    get_search_cache().clear()

    return CredentialsResponse(
        source_id=body.source_id,
        message=f"'{body.source_id}' の APIキーを設定しました。",
    )


@router.get(
    "/credentials/{source_id}/status",
    response_model=CredentialStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="APIキーの設定状態を確認する",
    description=(
        "指定したデータソースの APIキーが設定済みかどうかを返します。"
        "APIキー自体は返しません。"
        "未知の source_id も 200 + configured: false を返します。"
    ),
)
def get_credential_status(
    source_id: str,
    user_id: str = Depends(get_current_user),
    store: CredentialStore = Depends(get_credential_store),
) -> CredentialStatusResponse:
    """APIキーの設定状態を返す。

    Args:
        source_id: データソース識別子
        user_id: 認証済みユーザーID
        store: 依存注入された CredentialStore

    Returns:
        CredentialStatusResponse（api_key は含まない）
    """
    return CredentialStatusResponse(
        source_id=source_id,
        configured=store.is_configured(user_id, source_id),
    )
