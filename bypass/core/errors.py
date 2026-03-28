"""
ドメイン例外クラス定義

各例外は HTTP ステータスコードにマッピングされる:
- AuthenticationError     → 401 Unauthorized
- DatasetNotFoundError    → 404 Not Found
- UpstreamTimeoutError    → 504 Gateway Timeout
- UpstreamRateLimitError  → 429 Too Many Requests
"""


class OpenHubError(Exception):
    """全 OpenHub 例外の基底クラス。"""


class AuthenticationError(OpenHubError):
    """APIキー未設定、または認証失敗時に発生する。

    HTTP ステータス: 401 Unauthorized
    """


class DatasetNotFoundError(OpenHubError):
    """指定された dataset_id が存在しない場合に発生する。

    HTTP ステータス: 404 Not Found
    """


class UpstreamTimeoutError(OpenHubError):
    """上流 API がタイムアウトした場合に発生する。

    HTTP ステータス: 504 Gateway Timeout
    タイムアウト上限: 30秒
    """


class UpstreamRateLimitError(OpenHubError):
    """上流 API が 429 を返した場合に発生する。

    HTTP ステータス: 429 Too Many Requests
    バックオフ上限: 60秒
    """


