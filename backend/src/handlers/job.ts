import { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateJobRequest,
  ApiResponse,
  DEFAULT_CRAWL_CONFIG,
} from '../types';
import {
  createJob as createJobInDb,
  getJob,
  listJobs,
  getActiveJobCount,
  getDailyJobCount,
  updateJob,
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

  const { userId } = authResult.context;

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

  let request: CreateJobRequest;
  try {
    request = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, undefined, {
      code: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
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

  const result = await listJobs(userId, limit, offset);

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

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: reportContent,
  };
};
