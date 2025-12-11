/**
 * ECS Renderer
 *
 * Launches ECS Fargate tasks for rendering SPAs using Playwright.
 * Handles task lifecycle, result retrieval, and error handling.
 */

import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
  StopTaskCommand,
} from '@aws-sdk/client-ecs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { CrawledPage, Job } from '../types';

// ===================
// Configuration
// ===================

const ECS_CLUSTER_ARN = process.env.ECS_CLUSTER_ARN || '';
const ECS_RENDER_TASK_DEFINITION = process.env.ECS_RENDER_TASK_DEFINITION || '';
const ECS_SUBNET_IDS = (process.env.ECS_SUBNET_IDS || '').split(',');
const ECS_SECURITY_GROUP = process.env.ECS_SECURITY_GROUP || '';
const S3_BUCKET = process.env.S3_BUCKET || '';

// Task timeouts
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL_MS = 5000; // 5 seconds

// ===================
// Clients
// ===================

const ecsClient = new ECSClient({});
const s3Client = new S3Client({});

// ===================
// Types
// ===================

export interface RenderResult {
  success: boolean;
  pages: CrawledPage[];
  error?: string;
  durationMs: number;
  taskArn?: string;
}

export interface RenderOptions {
  maxPages?: number;
  timeout?: number;
  viewport?: { width: number; height: number };
  waitForSelector?: string;
  waitForTimeout?: number;
}

// ===================
// Main Functions
// ===================

/**
 * Render a URL using ECS Fargate Playwright task
 */
export async function renderWithECS(
  job: Job,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const startTime = Date.now();
  let taskArn: string | undefined;

  try {
    console.log(`[Renderer] Starting ECS render task for job ${job.id}`);

    // Launch ECS task
    taskArn = await launchRenderTask(job, options);
    console.log(`[Renderer] Task launched: ${taskArn}`);

    // Wait for task completion
    const taskResult = await waitForTask(taskArn, options.timeout || TASK_TIMEOUT_MS);
    
    if (!taskResult.success) {
      return {
        success: false,
        pages: [],
        error: taskResult.error,
        durationMs: Date.now() - startTime,
        taskArn,
      };
    }

    // Retrieve rendered pages from S3
    const pages = await retrieveRenderedPages(job.tenantId, job.id);

    console.log(`[Renderer] Render complete. ${pages.length} pages retrieved.`);

    return {
      success: true,
      pages,
      durationMs: Date.now() - startTime,
      taskArn,
    };
  } catch (error) {
    console.error(`[Renderer] Error:`, error);

    // Attempt to stop the task if it's still running
    if (taskArn) {
      await stopTask(taskArn).catch(() => {});
    }

    return {
      success: false,
      pages: [],
      error: (error as Error).message,
      durationMs: Date.now() - startTime,
      taskArn,
    };
  }
}

/**
 * Launch an ECS render task
 */
async function launchRenderTask(job: Job, options: RenderOptions): Promise<string> {
  const config = {
    jobId: job.id,
    tenantId: job.tenantId,
    targetUrl: job.targetUrl,
    maxPages: options.maxPages || job.config.maxPages,
    viewport: options.viewport || job.config.viewport,
    waitForSelector: options.waitForSelector,
    waitForTimeout: options.waitForTimeout || 5000,
  };

  const response = await ecsClient.send(
    new RunTaskCommand({
      cluster: ECS_CLUSTER_ARN,
      taskDefinition: ECS_RENDER_TASK_DEFINITION,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ECS_SUBNET_IDS,
          securityGroups: [ECS_SECURITY_GROUP],
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'renderer',
            environment: [
              { name: 'JOB_ID', value: job.id },
              { name: 'TENANT_ID', value: job.tenantId },
              { name: 'TARGET_URL', value: job.targetUrl },
              { name: 'CONFIG', value: JSON.stringify(config) },
              { name: 'S3_BUCKET', value: S3_BUCKET },
            ],
          },
        ],
      },
    })
  );

  const taskArn = response.tasks?.[0]?.taskArn;
  if (!taskArn) {
    throw new Error('Failed to launch ECS render task');
  }

  return taskArn;
}

/**
 * Wait for an ECS task to complete
 */
async function waitForTask(
  taskArn: string,
  timeout: number
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const maxAttempts = Math.ceil(timeout / POLL_INTERVAL_MS);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await ecsClient.send(
      new DescribeTasksCommand({
        cluster: ECS_CLUSTER_ARN,
        tasks: [taskArn],
      })
    );

    const task = response.tasks?.[0];
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const status = task.lastStatus;
    console.log(`[Renderer] Task status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);

    if (status === 'STOPPED') {
      const container = task.containers?.[0];
      const exitCode = container?.exitCode;

      if (exitCode === 0) {
        return { success: true };
      }

      const reason = container?.reason || task.stoppedReason || 'Unknown error';
      return { success: false, error: `Task failed: ${reason} (exit code: ${exitCode})` };
    }

    // Check for timeout
    if (Date.now() - startTime > timeout) {
      return { success: false, error: 'Task timed out' };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { success: false, error: 'Task did not complete in time' };
}

/**
 * Stop a running ECS task
 */
async function stopTask(taskArn: string): Promise<void> {
  await ecsClient.send(
    new StopTaskCommand({
      cluster: ECS_CLUSTER_ARN,
      task: taskArn,
      reason: 'Cancelled by orchestrator',
    })
  );
}

/**
 * Retrieve rendered pages from S3
 */
async function retrieveRenderedPages(
  tenantId: string,
  jobId: string
): Promise<CrawledPage[]> {
  const key = `${tenantId}/${jobId}/data/rendered-pages.json`;

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );

    const body = await response.Body?.transformToString();
    if (!body) {
      return [];
    }

    return JSON.parse(body) as CrawledPage[];
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      console.warn(`[Renderer] No rendered pages found at ${key}`);
      return [];
    }
    throw error;
  }
}

/**
 * Check if ECS rendering is available (task definition exists)
 */
export function isECSRenderingAvailable(): boolean {
  return !!(
    ECS_CLUSTER_ARN &&
    ECS_RENDER_TASK_DEFINITION &&
    ECS_SUBNET_IDS.length > 0 &&
    ECS_SECURITY_GROUP
  );
}

/**
 * Get estimated render time based on page count
 */
export function estimateRenderTime(pageCount: number): number {
  // Base time: 30 seconds for task startup
  const baseTime = 30000;
  // Per-page time: ~5 seconds per page
  const perPageTime = 5000;
  
  return baseTime + (pageCount * perPageTime);
}

