/**
 * Scheduled Crawl Handlers
 *
 * Manages scheduled/recurring crawl jobs using EventBridge.
 */

import type { APIGatewayProxyHandlerV2, EventBridgeHandler } from 'aws-lambda';
import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
  ListRulesCommand,
} from '@aws-sdk/client-eventbridge';
import { validateRequest } from '../lib/auth';
import { enqueueJob } from '../lib/sqs';
import { createJob, getUser } from '../lib/db';
import { type ApiResponse, type CreateJobRequest, DEFAULT_CRAWL_CONFIG } from '../types';
import { v4 as uuidv4 } from 'uuid';

// ===================
// Clients
// ===================

const eventBridgeClient = new EventBridgeClient({});

// ===================
// Types
// ===================

interface Schedule {
  id: string;
  userId: string;
  targetUrl: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  config?: Partial<CreateJobRequest>;
  createdAt: string;
}

interface ScheduledEvent {
  scheduleId: string;
  userId: string; // Changed from tenantId
  targetUrl: string;
  config?: Partial<CreateJobRequest>;
}

interface CreateScheduleBody {
  targetUrl: string;
  cronExpression: string;
  config?: Partial<CreateJobRequest>;
}

// ===================
// Handlers
// ===================

/**
 * POST /schedules
 * Create a new scheduled crawl
 */
export const createSchedule: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const authResult = await validateRequest(event);
    if (!authResult.success) {
      return formatResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: authResult.error || 'Unauthorized' },
      });
    }

    const userId = authResult.userId;
    const body = JSON.parse(event.body || '{}') as CreateScheduleBody;

    // Validate required fields
    if (!body.targetUrl) {
      return formatResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'targetUrl is required' },
      });
    }

    if (!body.cronExpression) {
      return formatResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'cronExpression is required' },
      });
    }

    // Validate cron expression format
    if (!isValidCronExpression(body.cronExpression)) {
      return formatResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid cron expression' },
      });
    }

    const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ruleName = `propintel-${userId}-${scheduleId}`;

    // Create EventBridge rule
    await eventBridgeClient.send(
      new PutRuleCommand({
        Name: ruleName,
        ScheduleExpression: `cron(${body.cronExpression})`,
        State: 'ENABLED',
        Description: `PropIntel scheduled crawl for ${body.targetUrl}`,
      })
    );

    // Create target (Lambda function)
    const functionArn = process.env.SCHEDULED_CRAWL_FUNCTION_ARN;
    if (functionArn) {
      await eventBridgeClient.send(
        new PutTargetsCommand({
          Rule: ruleName,
          Targets: [
            {
              Id: `${scheduleId}-target`,
              Arn: functionArn,
              Input: JSON.stringify({
                scheduleId,
                userId,
                targetUrl: body.targetUrl,
                config: body.config,
              } as ScheduledEvent),
            },
          ],
        })
      );
    }

    const schedule: Schedule = {
      id: scheduleId,
      userId,
      targetUrl: body.targetUrl,
      cronExpression: body.cronExpression,
      enabled: true,
      config: body.config,
      createdAt: new Date().toISOString(),
    };

    return formatResponse(201, {
      success: true,
      data: { schedule },
      meta: { requestId: event.requestContext?.requestId, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    return formatResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create schedule' },
    });
  }
};

/**
 * GET /schedules
 * List all schedules for user
 */
export const listSchedules: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const authResult = await validateRequest(event);
    if (!authResult.success) {
      return formatResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: authResult.error || 'Unauthorized' },
      });
    }

    const userId = authResult.userId;

    // List EventBridge rules for this user
    const response = await eventBridgeClient.send(
      new ListRulesCommand({
        NamePrefix: `propintel-${userId}-`,
      })
    );

    const schedules: Schedule[] = (response.Rules || []).map((rule: { Name?: string; ScheduleExpression?: string; State?: string }) => {
      const scheduleId = rule.Name?.replace(`propintel-${userId}-`, '') || '';
      return {
        id: scheduleId,
        userId,
        targetUrl: '', // Would need to store/retrieve this separately
        cronExpression: rule.ScheduleExpression?.replace('cron(', '').replace(')', '') || '',
        enabled: rule.State === 'ENABLED',
        createdAt: '', // Not available from EventBridge
      };
    });

    return formatResponse(200, {
      success: true,
      data: { schedules },
      meta: { requestId: event.requestContext?.requestId, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('List schedules error:', error);
    return formatResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list schedules' },
    });
  }
};

/**
 * DELETE /schedules/{id}
 * Delete a schedule
 */
export const deleteSchedule: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const authResult = await validateRequest(event);
    if (!authResult.success) {
      return formatResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: authResult.error || 'Unauthorized' },
      });
    }

    const userId = authResult.userId;
    const scheduleId = event.pathParameters?.id;

    if (!scheduleId) {
      return formatResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Schedule ID is required' },
      });
    }

    const ruleName = `propintel-${userId}-${scheduleId}`;

    // Remove targets first
    await eventBridgeClient.send(
      new RemoveTargetsCommand({
        Rule: ruleName,
        Ids: [`${scheduleId}-target`],
      })
    ).catch(() => { /* Ignore if no targets exist */ });

    // Delete the rule
    await eventBridgeClient.send(
      new DeleteRuleCommand({
        Name: ruleName,
      })
    );

    return formatResponse(200, {
      success: true,
      data: { deleted: scheduleId },
      meta: { requestId: event.requestContext?.requestId, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    return formatResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete schedule' },
    });
  }
};

/**
 * EventBridge scheduled event handler
 * Triggered by scheduled rules to start crawl jobs
 */
export const handleScheduledCrawl: EventBridgeHandler<'Scheduled Event', ScheduledEvent, void> = async (event) => {
  console.log('Scheduled crawl triggered:', JSON.stringify(event));

  const { userId, targetUrl, config } = event.detail || (event as unknown as ScheduledEvent);

  try {
    // Verify user exists
    const user = await getUser(userId);
    if (!user) {
      console.log(`User ${userId} not found, skipping scheduled crawl`);
      return;
    }

    // Build the job
    const now = new Date().toISOString();
    const jobId = uuidv4();
    
    const jobConfig = {
      ...DEFAULT_CRAWL_CONFIG,
      ...(config?.config || {}),
    };

    // Save job to database
    await createJob({
      id: jobId,
      userId,
      targetUrl,
      status: 'pending',
      config: jobConfig,
      competitors: config?.competitors || [],
      webhookUrl: config?.webhookUrl,
      llmModel: config?.llmModel || 'gpt-4o-mini',
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

    // Queue the job for processing
    await enqueueJob({
      jobId,
      tenantId: userId, // userId is the new tenantId for backward compatibility
      targetUrl,
      config: jobConfig as unknown as Record<string, unknown>,
      timestamp: now,
    });

    console.log(`Scheduled crawl job ${jobId} created for user ${userId}`);
  } catch (error) {
    console.error('Scheduled crawl failed:', error);
    throw error;
  }
};

// ===================
// Helper Functions
// ===================

function isValidCronExpression(expression: string): boolean {
  // Basic validation for AWS cron format
  // Format: minute hour day-of-month month day-of-week year
  const parts = expression.split(' ');
  if (parts.length !== 6) return false;

  // Very basic validation - AWS will do full validation
  return true;
}

function formatResponse(statusCode: number, body: ApiResponse<unknown>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
