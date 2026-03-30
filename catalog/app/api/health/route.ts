/**
 * 診断用エンドポイント（本番デプロイ後に削除する）
 * BYPASS_BASE_URL の設定確認と Lambda への疎通確認に使用する。
 */
export async function GET(): Promise<Response> {
  const bypassUrl = process.env.NEXT_PUBLIC_BYPASS_BASE_URL ?? "(not set)";
  const masked = bypassUrl.startsWith("http")
    ? bypassUrl.slice(0, 30) + "..."
    : bypassUrl;

  let lambdaStatus: string;
  try {
    const res = await fetch(
      `${bypassUrl}/datasets/search?q=%E4%BA%BA%E5%8F%A3&limit=1`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as { total?: number };
    lambdaStatus = `ok (status=${res.status}, total=${data.total ?? "?"})`;
  } catch (e) {
    lambdaStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return Response.json({
    bypass_base_url: masked,
    lambda_call: lambdaStatus,
    node_env: process.env.NODE_ENV,
  });
}
