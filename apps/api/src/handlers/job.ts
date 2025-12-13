import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  type CreateJobRequest,
  type ApiResponse,
  DEFAULT_CRAWL_CONFIG,
} from '../types';
import {
  createJob as createJobInDb,
  getJob,
  listJobs,
  listJobsBySite,
  getActiveJobCount,
  getDailyJobCount,
  updateJob,
  findRecentJobForUrl,
} from '../lib/db';
import { getReport as getReportFromS3 } from '../lib/s3';
import { enqueueJob } from '../lib/sqs';
import { authenticateRequest, checkRateLimit, canCreateJob } from '../lib/auth';

const MAX_CONCURRENT_JOBS = 5;
const MAX_PAGES_PER_JOB = 100;

function jsonResponse<T>(
  statusCode: number,
  data?: T,
  error?: { code: string; message: string; details?: string }
): APIGatewayProxyResultV2 {
  const response: ApiResponse<T> = {
    success: !error,
    data,
    error,
    meta: {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
    },
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  };
}

export const create: APIGatewayProxyHandlerV2 = async (event): Promise<APIGatewayProxyResultV2> => {
  const authResult = await authenticateRequest(event);
  if (!authResult.success) {
    return jsonResponse(401, undefined, authResult.error);
  }

  // Parse request body early to get userId/siteId if API key auth
  let request: CreateJobRequest;
  try {
    request = JSON.parse(event.body || '{}') as CreateJobRequest;
  } catch {
    return jsonResponse(400, undefined, {
      code: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
    });
  }

  // Determine final userId - use body userId if API key auth, otherwise auth context
  let userId = authResult.context.userId;

  if (authResult.context.isApiKeyAuth) {
    if (!request.userId) {
      return jsonResponse(400, undefined, {
        code: 'MISSING_USER_ID',
        message: 'userId is required when using API key authentication',
      });
    }
    userId = request.userId;
  }

  // siteId comes from request body for both auth methods
  const siteId = request.siteId;

  console.log(`[Job] Auth: isApiKeyAuth=${authResult.context.isApiKeyAuth}, body.userId=${request.userId}, final userId=${userId}, siteId=${siteId}`);

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return jsonResponse(429, undefined, {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    });
  }

  // Check daily job limit (removed - no limit)
  // Previously: const dailyJobCount = await getDailyJobCount(userId);
  // Previously: if (dailyJobCount >= 10) { ... }
  
  const canCreate = canCreateJob(userId);
  if (!canCreate.allowed) {
    return jsonResponse(403, undefined, {
      code: 'LIMIT_EXCEEDED',
      message: canCreate.reason || 'Cannot create job',
    });
  }

  const activeJobs = await getActiveJobCount(userId);
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return jsonResponse(409, undefined, {
      code: 'CONCURRENT_LIMIT',
      message: `Maximum concurrent jobs (${MAX_CONCURRENT_JOBS}) reached. Wait for current jobs to complete.`,
    });
  }

  if (!request.targetUrl) {
    return jsonResponse(400, undefined, {
      code: 'MISSING_FIELD',
      message: 'targetUrl is required',
    });
  }

  try {
    new URL(request.targetUrl);
  } catch {
    return jsonResponse(400, undefined, {
      code: 'INVALID_URL',
      message: 'targetUrl must be a valid URL',
    });
  }

  // Check for duplicate/recent jobs for the same URL
  const existingJob = await findRecentJobForUrl(userId, request.targetUrl);
  if (existingJob) {
    // If there's an active or recent job, return it instead of creating a new one
    const isActive = ['pending', 'queued', 'crawling', 'analyzing'].includes(existingJob.status);
    console.log(`[Job] Found ${isActive ? 'active' : 'recent'} job ${existingJob.id} for URL ${request.targetUrl}`);
    
    return jsonResponse(200, { 
      job: existingJob,
      deduplicated: true,
      message: isActive 
        ? 'An analysis for this URL is already in progress' 
        : 'A recent analysis for this URL was found',
    });
  }

  const config = {
    ...DEFAULT_CRAWL_CONFIG,
    ...request.config,
    maxPages: Math.min(
      request.config?.maxPages || DEFAULT_CRAWL_CONFIG.maxPages,
      MAX_PAGES_PER_JOB
    ),
  };

  const jobId = uuidv4();
  const now = new Date().toISOString();

  await createJobInDb({
    id: jobId,
    userId,
    siteId,
    targetUrl: request.targetUrl,
    status: 'pending',
    config,
    competitors: request.competitors || [],
    webhookUrl: request.webhookUrl,
    authConfig: request.authConfig,
    llmModel: request.llmModel || 'gpt-4o-mini',
    progress: {
      pagesCrawled: 0,
      pagesTotal: 0,
      currentPhase: 'pending',
    },
    metrics: {
      apiCallsCount: 0,
      storageUsedBytes: 0,
    },
  });

  await enqueueJob({
    jobId,
    tenantId: userId, // userId is the new tenantId
    targetUrl: request.targetUrl,
    config: config as unknown as Record<string, unknown>,
    timestamp: now,
  });

  // Update job status to queued after enqueueing
  await updateJob(userId, jobId, {
    status: 'queued',
  });

  const job = await getJob(userId, jobId);

  return jsonResponse(201, { job });
};

export const get: APIGatewayProxyHandlerV2 = async (event): Promise<APIGatewayProxyResultV2> => {
  const authResult = await authenticateRequest(event);
  if (!authResult.success) {
    return jsonResponse(401, undefined, authResult.error);
  }

  const { userId } = authResult.context;
  const jobId = event.pathParameters?.id;

  if (!jobId) {
    return jsonResponse(400, undefined, {
      code: 'MISSING_PARAMETER',
      message: 'Job ID is required',
    });
  }

  const job = await getJob(userId, jobId);

  if (!job) {
    return jsonResponse(404, undefined, {
      code: 'NOT_FOUND',
      message: 'Job not found',
    });
  }

  return jsonResponse(200, { job });
};

export const list: APIGatewayProxyHandlerV2 = async (event): Promise<APIGatewayProxyResultV2> => {
  const authResult = await authenticateRequest(event);
  if (!authResult.success) {
    return jsonResponse(401, undefined, authResult.error);
  }

  const { userId } = authResult.context;

  const limit = Math.min(
    parseInt(event.queryStringParameters?.limit || '20', 10),
    100
  );
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
  const siteId = event.queryStringParameters?.siteId;

  const result = siteId
    ? await listJobsBySite(userId, siteId, limit, offset)
    : await listJobs(userId, limit, offset);

  return jsonResponse(200, {
    jobs: result.jobs,
    pagination: {
      limit,
      offset,
      hasMore: result.hasMore,
    },
  });
};

export const getReport: APIGatewayProxyHandlerV2 = async (event): Promise<APIGatewayProxyResultV2> => {
  const authResult = await authenticateRequest(event);
  if (!authResult.success) {
    return jsonResponse(401, undefined, authResult.error);
  }

  const { userId } = authResult.context;
  const jobId = event.pathParameters?.id;
  const format = (event.queryStringParameters?.format || 'json') as 'json' | 'md';

  if (!jobId) {
    return jsonResponse(400, undefined, {
      code: 'MISSING_PARAMETER',
      message: 'Job ID is required',
    });
  }

  const job = await getJob(userId, jobId);

  if (!job) {
    return jsonResponse(404, undefined, {
      code: 'NOT_FOUND',
      message: 'Job not found',
    });
  }

  if (job.status !== 'completed') {
    return jsonResponse(409, undefined, {
      code: 'NOT_READY',
      message: `Job is not completed. Current status: ${job.status}`,
    });
  }

  const reportContent = await getReportFromS3(userId, jobId, format);

  if (!reportContent) {
    return jsonResponse(404, undefined, {
      code: 'REPORT_NOT_FOUND',
      message: 'Report not found',
    });
  }

  if (format === 'md') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/markdown',
      },
      body: reportContent,
    };
  }

  // Wrap JSON report in standard API response format
  const report = JSON.parse(reportContent) as Record<string, unknown>;
  return jsonResponse(200, report);
};
