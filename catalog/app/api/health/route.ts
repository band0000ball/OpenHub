export async function GET(): Promise<Response> {
  const bucketName = process.env.CACHE_BUCKET_NAME ?? "(not set)";
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "(not set)";

  const diagnostics: Record<string, unknown> = {
    CACHE_BUCKET_NAME: bucketName,
    AWS_REGION: region,
    timestamp: new Date().toISOString(),
  };

  // S3 接続テスト
  try {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({});
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: "catalog/last_updated.json",
    });
    const response = await s3.send(command);
    const body = await response.Body!.transformToString();
    diagnostics.s3_status = "OK";
    diagnostics.s3_data = JSON.parse(body);
  } catch (error: unknown) {
    diagnostics.s3_status = "ERROR";
    diagnostics.s3_error = error instanceof Error ? error.message : String(error);
  }

  return Response.json(diagnostics);
}
