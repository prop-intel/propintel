import {
  SQSClient,
  SendMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL || '';
const IS_LOCAL = process.env.IS_OFFLINE === 'true' || !QUEUE_URL;

export interface CrawlJobMessage {
  jobId: string;
  tenantId: string;
  targetUrl: string;
  config: Record<string, unknown>;
  timestamp: string;
}

export async function enqueueJob(message: CrawlJobMessage): Promise<string> {
  if (IS_LOCAL) {
    console.log('[SQS-LOCAL] Processing job directly in local mode:', {
      jobId: message.jobId,
      targetUrl: message.targetUrl,
    });
    
    process.nextTick(async () => {
      try {
        const { handler } = await import('../handlers/orchestrator');
        const mockSQSEvent = {
          Records: [{
            body: JSON.stringify(message),
            receiptHandle: `local-${message.jobId}`,
            messageId: `local-${message.jobId}`,
            attributes: {},
            messageAttributes: {},
            md5OfBody: '',
            eventSource: 'aws:sqs',
            eventSourceARN: '',
            awsRegion: 'local',
          }],
        };
        handler(mockSQSEvent as any, {} as any, () => {}).catch((error) => {
          console.error('[SQS-LOCAL] Error processing job:', {
            jobId: message.jobId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      } catch (error) {
        console.error('[SQS-LOCAL] Failed to import or invoke orchestrator:', error);
      }
    });
    
    return `local-${message.jobId}`;
  }

  const result = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        tenantId: {
          DataType: 'String',
          StringValue: message.tenantId,
        },
        jobId: {
          DataType: 'String',
          StringValue: message.jobId,
        },
      },
    })
  );

  return result.MessageId || '';
}

export async function deleteMessage(receiptHandle: string): Promise<void> {
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle,
    })
  );
}

export async function queueCrawlJob(jobId: string, tenantId: string): Promise<string> {
  const message: CrawlJobMessage = {
    jobId,
    tenantId,
    targetUrl: '',
    config: {},
    timestamp: new Date().toISOString(),
  };

  return enqueueJob(message);
}

