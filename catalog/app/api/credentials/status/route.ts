import { getAccessToken } from "../../../../lib/auth-helpers";
import { getSourcesRequiringApiKey } from "../../../../lib/sources";
import { getCredentialStatus } from "../../../../lib/api";

export async function GET(): Promise<Response> {
  const accessToken = await getAccessToken().catch(() => undefined);
  const sources = getSourcesRequiringApiKey();

  try {
    const statuses = await Promise.all(
      sources.map(async (source) => ({
        id: source.id,
        label: source.label,
        configured: await getCredentialStatus(source.id, accessToken),
      })),
    );

    const unconfigured = statuses.filter((s) => !s.configured);
    return Response.json({ unconfigured });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Status check failed: ${message}` }, { status: 502 });
  }
}
