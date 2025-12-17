import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const BUCKET_NAME = process.env.S3_BUCKET || 'propintel-api-dev-storage';
const IS_LOCAL = process.env.USE_LOCAL_STORAGE === 'true';
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_PATH || '../api/.local-storage';

// S3 key builders (must match API's s3Keys)
function getReportKey(userId: string, jobId: string, format: 'json' | 'md'): string {
  return `${userId}/${jobId}/reports/report.${format}`;
}

function getPageDataKey(userId: string, jobId: string): string {
  return `${userId}/${jobId}/data/pages.json`;
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

/**
 * Read page data directly from S3 or local storage
 * For server-side use only (tRPC routes)
 */
export async function getPageData(
  userId: string,
  jobId: string
): Promise<CrawledPageData[] | null> {
  const key = getPageDataKey(userId, jobId);

  if (IS_LOCAL) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_STORAGE_DIR, key);

    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CrawledPageData[];
  }

  try {
    const response = await s3Client!.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    const content = await response.Body?.transformToString();
    return content ? (JSON.parse(content) as CrawledPageData[]) : null;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

/**
 * List snapshot files from S3 or local storage and extract URLs
 * Falls back option when pages.json doesn't exist
 */
export async function listSnapshots(
  userId: string,
  jobId: string
): Promise<string[]> {
  const prefix = `${userId}/${jobId}/snapshots/`;

  if (IS_LOCAL) {
    const fs = await import('fs');
    const path = await import('path');
    const snapshotsDir = path.join(process.cwd(), LOCAL_STORAGE_DIR, prefix);

    if (!fs.existsSync(snapshotsDir)) {
      return [];
    }

    const files = fs.readdirSync(snapshotsDir);
    return files
      .filter(f => f.endsWith('.html'))
      .map(f => decodeURIComponent(f.replace('.html', '')));
  }

  try {
    const response = await s3Client!.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
      })
    );

    const urls: string[] = [];
    for (const obj of response.Contents ?? []) {
      if (obj.Key?.endsWith('.html')) {
        // Extract URL from key: {userId}/{jobId}/snapshots/{encodedUrl}.html
        const filename = obj.Key.split('/').pop();
        if (filename) {
          const url = decodeURIComponent(filename.replace('.html', ''));
          urls.push(url);
        }
      }
    }
    return urls;
  } catch (error: unknown) {
    console.error('Error listing snapshots:', error);
    return [];
  }
}

// Type for crawled page data from S3 (matches API's CrawledPage structure)
export interface CrawledPageData {
  url: string;
  canonicalUrl?: string;
  statusCode?: number;
  contentType?: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount?: number;
  language?: string;
  lastModified?: string;
  loadTimeMs?: number;
  htmlSnapshot?: string;
  crawledAt?: string;
  warnings?: string[];
  schemas?: Array<{
    type: string;
    properties: Record<string, unknown>;
    isValid: boolean;
    errors?: string[];
  }>;
  links?: {
    internal: string[];
    external: string[];
  };
  images?: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    hasAlt: boolean;
  }>;
  headings?: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  robotsMeta?: {
    noindex: boolean;
    nofollow: boolean;
  };
  hreflangAlternates?: Array<{
    lang: string;
    url: string;
  }>;
}
