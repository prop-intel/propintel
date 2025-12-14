import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db, jobs, crawledPages, reports, analyses, authUser } from '../server/db';
import type { Job, NewJob, Analysis } from '@propintel/database';
import type { CrawledPage as CrawledPageType, JobStatus } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ===================
// User Operations
// ===================

export async function getUser(userId: string) {
  const result = await db.query.authUser.findFirst({
    where: eq(authUser.id, userId),
  });
  return result ?? null;
}

// ===================
// Job Operations
// ===================

export async function createJob(jobData: {
  id: string;
  userId: string;
  siteId?: string;
  targetUrl: string;
  status?: JobStatus;
  config?: NewJob['config'];
  competitors?: string[];
  webhookUrl?: string;
  authConfig?: NewJob['authConfig'];
  llmModel?: string;
  progress?: NewJob['progress'];
  metrics?: NewJob['metrics'];
}): Promise<void> {
  await db.insert(jobs).values({
    id: jobData.id,
    userId: jobData.userId,
    siteId: jobData.siteId,
    targetUrl: jobData.targetUrl,
    status: jobData.status || 'pending',
    config: jobData.config,
    competitors: jobData.competitors || [],
    webhookUrl: jobData.webhookUrl,
    authConfig: jobData.authConfig,
    llmModel: jobData.llmModel || 'gpt-4o-mini',
    progress: jobData.progress || { pagesCrawled: 0, pagesTotal: 0, currentPhase: 'pending' },
    metrics: jobData.metrics || { apiCallsCount: 0, storageUsedBytes: 0 },
  });
}

export async function getJob(userId: string, jobId: string): Promise<Job | null> {
  if (!isValidUUID(jobId)) {
    return null;
  }
  const result = await db.query.jobs.findFirst({
    where: and(eq(jobs.userId, userId), eq(jobs.id, jobId)),
  });
  return result ?? null;
}

export async function getJobById(jobId: string): Promise<Job | null> {
  if (!isValidUUID(jobId)) {
    return null;
  }
  const result = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });
  return result ?? null;
}

// Type for job updates that supports both top-level and nested properties
type JobUpdate = Partial<{
  status: JobStatus;
  progress: Job['progress'];
  metrics: Job['metrics'];
  error: Job['error'];
  'progress.pagesCrawled': number;
  'progress.pagesTotal': number;
  'progress.currentPhase': string;
  'metrics.startedAt': string;
  'metrics.completedAt': string;
  'metrics.durationMs': number;
}>;

export async function updateJob(
  userId: string,
  jobId: string,
  updates: JobUpdate
): Promise<void> {
  // First try to get the job by ID only (faster, no userId check)
  // This is more resilient to timing issues where the job was just created
  let currentJob = await getJobById(jobId);
  
  // If not found, try with userId (for security validation)
  if (!currentJob) {
    currentJob = await getJob(userId, jobId);
  }
  
  if (!currentJob) {
    throw new Error(`Job ${jobId} not found`);
  }

  // Verify the job belongs to the user (security check)
  if (currentJob.userId !== userId) {
    throw new Error(`Job ${jobId} does not belong to user ${userId}`);
  }

  const updateValues: Partial<Job> = {
    updatedAt: new Date(),
  };

  const defaultProgress = { pagesCrawled: 0, pagesTotal: 0, currentPhase: 'pending' };
  const defaultMetrics = { apiCallsCount: 0, storageUsedBytes: 0 };

  for (const [key, value] of Object.entries(updates)) {
    if (key.startsWith('progress.')) {
      const field = key.replace('progress.', '') as keyof NonNullable<Job['progress']>;
      updateValues.progress = {
        ...defaultProgress,
        ...currentJob.progress,
        [field]: value,
      };
    } else if (key.startsWith('metrics.')) {
      const field = key.replace('metrics.', '') as keyof NonNullable<Job['metrics']>;
      updateValues.metrics = {
        ...defaultMetrics,
        ...currentJob.metrics,
        [field]: value,
      };
    } else if (key === 'status') {
      updateValues.status = value as JobStatus;
    } else if (key === 'progress') {
      updateValues.progress = value as Job['progress'];
    } else if (key === 'metrics') {
      updateValues.metrics = value as Job['metrics'];
    } else if (key === 'error') {
      updateValues.error = value as Job['error'];
    }
  }

  await db.update(jobs)
    .set(updateValues)
    .where(and(eq(jobs.userId, userId), eq(jobs.id, jobId)));
}

export async function listJobs(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ jobs: Job[]; hasMore: boolean }> {
  const result = await db.query.jobs.findMany({
    where: eq(jobs.userId, userId),
    orderBy: [desc(jobs.createdAt)],
    limit: limit + 1, // Get one extra to check if there are more
    offset,
  });

  const hasMore = result.length > limit;
  if (hasMore) {
    result.pop(); // Remove the extra item
  }

  return { jobs: result, hasMore };
}

export async function listJobsBySite(
  userId: string,
  siteId: string,
  limit = 20,
  offset = 0
): Promise<{ jobs: Job[]; hasMore: boolean }> {
  const result = await db.query.jobs.findMany({
    where: and(eq(jobs.userId, userId), eq(jobs.siteId, siteId)),
    orderBy: [desc(jobs.createdAt)],
    limit: limit + 1,
    offset,
  });

  const hasMore = result.length > limit;
  if (hasMore) {
    result.pop();
  }

  return { jobs: result, hasMore };
}

export async function listJobsForUser(
  userId: string,
  limit = 20
): Promise<Job[]> {
  const result = await db.query.jobs.findMany({
    where: eq(jobs.userId, userId),
    orderBy: [desc(jobs.createdAt)],
    limit,
  });
  return result;
}

export async function getActiveJobCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        inArray(jobs.status, ['pending', 'queued', 'crawling', 'analyzing'])
      )
    );
  return Number(result[0]?.count ?? 0);
}

export async function getDailyJobCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        sql`DATE(${jobs.createdAt}) = CURRENT_DATE`
      )
    );
  return Number(result[0]?.count ?? 0);
}

/**
 * Find active or recent jobs for the same URL (for deduplication)
 * Returns a job if one exists that is:
 * - Active (pending, queued, crawling, analyzing)
 * - Or completed within the last 5 minutes
 */
export async function findRecentJobForUrl(
  userId: string, 
  targetUrl: string
): Promise<Job | null> {
  // Check for active jobs first
  const activeJob = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.userId, userId),
      eq(jobs.targetUrl, targetUrl),
      inArray(jobs.status, ['pending', 'queued', 'crawling', 'analyzing'])
    ),
    orderBy: [desc(jobs.createdAt)],
  });

  if (activeJob) {
    return activeJob;
  }

  // Check for recently completed jobs (within 5 minutes)
  const recentJob = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.userId, userId),
      eq(jobs.targetUrl, targetUrl),
      eq(jobs.status, 'completed'),
      sql`${jobs.updatedAt} > NOW() - INTERVAL '5 minutes'`
    ),
    orderBy: [desc(jobs.createdAt)],
  });

  return recentJob ?? null;
}

// ===================
// Page Operations
// ===================

export async function savePage(
  jobId: string,
  page: CrawledPageType
): Promise<void> {
  await db.insert(crawledPages).values({
    jobId,
    url: page.url,
    canonicalUrl: page.canonicalUrl,
    statusCode: page.statusCode,
    contentType: page.contentType,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    wordCount: page.wordCount,
    language: page.language,
    lastModified: page.lastModified,
    loadTimeMs: page.loadTimeMs,
    data: {
      schemas: page.schemas,
      links: page.links,
      images: page.images,
      headings: page.headings,
      robotsMeta: page.robotsMeta,
      hreflangAlternates: page.hreflangAlternates,
      warnings: page.warnings,
    },
    snapshotS3Key: page.htmlSnapshot,
  });
}

export async function savePages(
  jobId: string,
  pages: CrawledPageType[]
): Promise<void> {
  if (pages.length === 0) return;

  const values = pages.map((page) => ({
    jobId,
    url: page.url,
    canonicalUrl: page.canonicalUrl,
    statusCode: page.statusCode,
    contentType: page.contentType,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    wordCount: page.wordCount,
    language: page.language,
    lastModified: page.lastModified,
    loadTimeMs: page.loadTimeMs,
    data: {
      schemas: page.schemas,
      links: page.links,
      images: page.images,
      headings: page.headings,
      robotsMeta: page.robotsMeta,
      hreflangAlternates: page.hreflangAlternates,
      warnings: page.warnings,
    },
    snapshotS3Key: page.htmlSnapshot,
  }));

  await db.insert(crawledPages).values(values);
}

export async function getPages(jobId: string): Promise<CrawledPageType[]> {
  const result = await db.query.crawledPages.findMany({
    where: eq(crawledPages.jobId, jobId),
  });

  return result.map((page) => ({
    url: page.url,
    canonicalUrl: page.canonicalUrl ?? undefined,
    statusCode: page.statusCode ?? 200,
    contentType: page.contentType ?? 'text/html',
    title: page.title ?? undefined,
    metaDescription: page.metaDescription ?? undefined,
    h1: page.h1 ?? undefined,
    wordCount: page.wordCount ?? 0,
    language: page.language ?? undefined,
    lastModified: page.lastModified ?? undefined,
    schemas: page.data?.schemas ?? [],
    links: page.data?.links ?? { internal: [], external: [] },
    images: page.data?.images ?? [],
    headings: page.data?.headings ?? { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
    robotsMeta: page.data?.robotsMeta ?? { noindex: false, nofollow: false },
    hreflangAlternates: page.data?.hreflangAlternates ?? [],
    loadTimeMs: page.loadTimeMs ?? 0,
    htmlSnapshot: page.snapshotS3Key ?? undefined,
    crawledAt: page.crawledAt.toISOString(),
    warnings: page.data?.warnings ?? [],
  }));
}

// ===================
// Report Operations
// ===================

export async function saveReportReference(
  jobId: string,
  s3KeyJson: string,
  s3KeyMarkdown?: string
): Promise<void> {
  console.log(`[DB] Saving report reference for job ${jobId}:`, { s3KeyJson, s3KeyMarkdown });
  await db.insert(reports).values({
    jobId,
    s3KeyJson,
    s3KeyMarkdown,
  }).onConflictDoUpdate({
    target: reports.jobId,
    set: {
      s3KeyJson,
      s3KeyMarkdown,
    },
  });
  console.log(`[DB] Report reference saved successfully for job ${jobId}`);
}

export async function getReportReference(jobId: string): Promise<string | null> {
  const result = await db.query.reports.findFirst({
    where: eq(reports.jobId, jobId),
  });
  return result?.s3KeyJson ?? null;
}

// ===================
// Analysis Operations
// ===================

/**
 * Save analysis summary
 */
export async function saveAnalysis(
  userId: string,
  jobId: string,
  analysisData: {
    domain: string;
    scores: NonNullable<Analysis['scores']>;
    keyMetrics: NonNullable<Analysis['keyMetrics']>;
    summary: NonNullable<Analysis['summary']>;
    reportS3Key: string;
  }
): Promise<void> {
  await db.insert(analyses).values({
    jobId,
    userId,
    domain: analysisData.domain,
    scores: analysisData.scores,
    keyMetrics: analysisData.keyMetrics,
    summary: analysisData.summary,
    reportS3Key: analysisData.reportS3Key,
  }).onConflictDoUpdate({
    target: analyses.jobId,
    set: {
      domain: analysisData.domain,
      scores: analysisData.scores,
      keyMetrics: analysisData.keyMetrics,
      summary: analysisData.summary,
      reportS3Key: analysisData.reportS3Key,
      generatedAt: new Date(),
    },
  });
}

/**
 * Get analysis for a job
 */
export async function getAnalysis(jobId: string): Promise<Analysis | null> {
  const result = await db.query.analyses.findFirst({
    where: eq(analyses.jobId, jobId),
  });
  return result ?? null;
}

/**
 * List analyses for a user with optional domain filter
 */
export async function listAnalyses(
  userId: string,
  options: {
    domain?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ analyses: Analysis[]; hasMore: boolean }> {
  const { domain, limit = 20, offset = 0 } = options;

  const conditions = [eq(analyses.userId, userId)];
  if (domain) {
    conditions.push(eq(analyses.domain, domain));
  }

  const result = await db.query.analyses.findMany({
    where: and(...conditions),
    orderBy: [desc(analyses.generatedAt)],
    limit: limit + 1,
    offset,
  });

  const hasMore = result.length > limit;
  if (hasMore) {
    result.pop();
  }

  return { analyses: result, hasMore };
}

// ===================
// Legacy Compatibility Layer
// ===================

// These functions maintain backward compatibility with the old DynamoDB-style API
// where tenantId was used instead of userId. In the new system, User = Tenant.

/**
 * @deprecated Use getJob(userId, jobId) instead
 */
export { getJob as getJobByTenant };

/**
 * @deprecated Use updateJob(userId, jobId, updates) instead
 */
export { updateJob as updateJobByTenant };

/**
 * @deprecated Use listJobsForUser instead
 */
export const listJobsForTenant = listJobsForUser;
