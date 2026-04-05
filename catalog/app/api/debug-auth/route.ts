import { getAccessToken } from "../../../lib/auth-helpers";

export async function GET(): Promise<Response> {
  const accessToken = await getAccessToken().catch(() => undefined);

  return Response.json({
    hasToken: !!accessToken,
    tokenLength: accessToken?.length ?? 0,
    tokenPrefix: accessToken?.substring(0, 20) ?? "(none)",
    timestamp: new Date().toISOString(),
  });
}
