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

from core.credentials import CredentialStore, get_credential_store

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
    store: CredentialStore = Depends(get_credential_store),
) -> CredentialsResponse:
    """APIキーを登録する。

    Args:
        body: リクエストボディ
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
    store.set(body.source_id, body.api_key)

    return CredentialsResponse(
        source_id=body.source_id,
        message=f"'{body.source_id}' の APIキーを設定しました。",
    )
