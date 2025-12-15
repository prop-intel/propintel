import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const BUCKET_NAME = process.env.S3_BUCKET || 'propintel-api-dev-storage';
const IS_LOCAL = process.env.USE_LOCAL_STORAGE === 'true';
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_PATH || '../api/.local-storage';

// S3 key builder (must match API's s3Keys.report)
function getReportKey(userId: string, jobId: string, format: 'json' | 'md'): string {
  return `${userId}/${jobId}/reports/report.${format}`;
}

let s3Client: S3Client | null = null;
if (!IS_LOCAL) {
  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.AWS_REGION || 'us-west-2',
  };

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  s3Client = new S3Client(clientConfig);
}

/**
 * Read report directly from S3 or local storage
 * For server-side use only (tRPC routes)
 */
export async function getReport(
  userId: string,
  jobId: string,
  format: 'json' | 'md' = 'json'
): Promise<string | null> {
  const key = getReportKey(userId, jobId, format);

  if (IS_LOCAL) {
    // Read from local filesystem (same location as API's .local-storage)
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_STORAGE_DIR, key);

    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  try {
    const response = await s3Client!.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return (await response.Body?.transformToString()) ?? null;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}
