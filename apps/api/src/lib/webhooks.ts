/**
 * Enhanced Webhook Delivery
 *
 * Supports Slack, Discord, and generic webhooks with
 * formatted payloads and retry logic.
 */

import { type AEOReport, type Report } from '../types';

// ===================
// Types
// ===================

export type WebhookType = 'generic' | 'slack' | 'discord';

export interface WebhookConfig {
  url: string;
  type?: WebhookType;
  secret?: string;
  includeFullReport?: boolean;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: unknown;
}

// ===================
// Main Functions
// ===================

/**
 * Send webhook notification
 */
export async function sendWebhook(
  config: WebhookConfig,
  event: string,
  report: AEOReport | Report
): Promise<{ success: boolean; error?: string }> {
  try {
    const webhookType = detectWebhookType(config.url, config.type);
    let payload: unknown;

    switch (webhookType) {
      case 'slack':
        payload = formatSlackPayload(event, report);
        break;
      case 'discord':
        payload = formatDiscordPayload(event, report);
        break;
      default:
        payload = formatGenericPayload(event, report, config.includeFullReport);
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Send webhook with retry logic
 */
export async function sendWebhookWithRetry(
  config: WebhookConfig,
  event: string,
  report: AEOReport | Report,
  maxRetries = 3
): Promise<{ success: boolean; attempts: number; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendWebhook(config, event, report);

    if (result.success) {
      return { success: true, attempts: attempt };
    }

    lastError = result.error;

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return { success: false, attempts: maxRetries, error: lastError };
}

// ===================
// Payload Formatters
// ===================

/**
 * Format Slack webhook payload
 */
function formatSlackPayload(event: string, report: AEOReport | Report): unknown {
  const isAEO = 'aeoAnalysis' in report;
  const domain = report.meta.domain;
  const scores = report.scores;

  const aeoScore = isAEO ? (report).scores.aeoVisibilityScore : 0;
  const overallScore = scores.overallScore;

  // Determine color based on score
  const color = aeoScore >= 70 ? '#36a64f' : aeoScore >= 40 ? '#daa520' : '#dc3545';

  return {
    attachments: [
      {
        color,
        pretext: event === 'job.completed' 
          ? `:white_check_mark: AEO Analysis Complete`
          : `:x: AEO Analysis Failed`,
        title: domain,
        title_link: `https://${domain}`,
        fields: [
          {
            title: 'AEO Visibility Score',
            value: `${aeoScore}/100`,
            short: true,
          },
          {
            title: 'Overall Score',
            value: `${overallScore}/100`,
            short: true,
          },
          {
            title: 'LLMEO Score',
            value: `${scores.llmeoScore}/100`,
            short: true,
          },
          {
            title: 'SEO Score',
            value: `${scores.seoScore}/100`,
            short: true,
          },
          {
            title: 'Pages Analyzed',
            value: `${report.meta.pagesAnalyzed}`,
            short: true,
          },
          {
            title: 'Confidence',
            value: `${Math.round(scores.confidence * 100)}%`,
            short: true,
          },
        ],
        footer: 'PropIntel AEO Analyzer',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

/**
 * Format Discord webhook payload
 */
function formatDiscordPayload(event: string, report: AEOReport | Report): unknown {
  const isAEO = 'aeoAnalysis' in report;
  const domain = report.meta.domain;
  const scores = report.scores;

  const aeoScore = isAEO ? (report).scores.aeoVisibilityScore : 0;
  const overallScore = scores.overallScore;

  // Determine color based on score (Discord uses decimal colors)
  const color = aeoScore >= 70 ? 3584348 : aeoScore >= 40 ? 14329120 : 14431557;

  return {
    embeds: [
      {
        title: event === 'job.completed' 
          ? 'AEO Analysis Complete'
          : 'AEO Analysis Failed',
        description: `Analysis for **${domain}**`,
        color,
        fields: [
          {
            name: 'AEO Visibility',
            value: `${aeoScore}/100`,
            inline: true,
          },
          {
            name: 'Overall Score',
            value: `${overallScore}/100`,
            inline: true,
          },
          {
            name: 'Pages Analyzed',
            value: `${report.meta.pagesAnalyzed}`,
            inline: true,
          },
          {
            name: 'Scores',
            value: `LLMEO: ${scores.llmeoScore} | SEO: ${scores.seoScore}`,
            inline: false,
          },
        ],
        footer: {
          text: 'PropIntel AEO Analyzer',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Format generic webhook payload
 */
function formatGenericPayload(
  event: string,
  report: AEOReport | Report,
  includeFullReport = false
): WebhookPayload {
  const isAEO = 'aeoAnalysis' in report;

  const summary = {
    domain: report.meta.domain,
    jobId: report.meta.jobId,
    pagesAnalyzed: report.meta.pagesAnalyzed,
    scores: {
      aeoVisibility: isAEO ? (report).scores.aeoVisibilityScore : null,
      llmeo: report.scores.llmeoScore,
      seo: report.scores.seoScore,
      overall: report.scores.overallScore,
      confidence: report.scores.confidence,
    },
    completedAt: report.meta.generatedAt,
  };

  return {
    event,
    timestamp: new Date().toISOString(),
    data: includeFullReport ? { summary, report } : { summary },
  };
}

// ===================
// Helper Functions
// ===================

/**
 * Detect webhook type from URL
 */
function detectWebhookType(url: string, explicitType?: WebhookType): WebhookType {
  if (explicitType) return explicitType;

  if (url.includes('hooks.slack.com')) return 'slack';
  if (url.includes('discord.com/api/webhooks')) return 'discord';

  return 'generic';
}

/**
 * Create alert webhook payload
 */
export function createAlertPayload(
  alertType: string,
  severity: 'critical' | 'warning' | 'info',
  message: string,
  details: Record<string, unknown> = {}
): WebhookPayload {
  return {
    event: `alert.${alertType}`,
    timestamp: new Date().toISOString(),
    data: {
      severity,
      message,
      ...details,
    },
  };
}

/**
 * Send alert webhook
 */
export async function sendAlertWebhook(
  config: WebhookConfig,
  alertType: string,
  severity: 'critical' | 'warning' | 'info',
  message: string,
  details: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const webhookType = detectWebhookType(config.url, config.type);
    let payload: unknown;

    if (webhookType === 'slack') {
      const color = severity === 'critical' ? '#dc3545' : severity === 'warning' ? '#daa520' : '#17a2b8';
      payload = {
        attachments: [{
          color,
          pretext: `:warning: PropIntel Alert`,
          title: message,
          fields: Object.entries(details).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true,
          })),
          footer: `Severity: ${severity}`,
          ts: Math.floor(Date.now() / 1000),
        }],
      };
    } else if (webhookType === 'discord') {
      const color = severity === 'critical' ? 14431557 : severity === 'warning' ? 14329120 : 1535999;
      payload = {
        embeds: [{
          title: `Alert: ${alertType}`,
          description: message,
          color,
          fields: Object.entries(details).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true,
          })),
          footer: { text: `Severity: ${severity}` },
          timestamp: new Date().toISOString(),
        }],
      };
    } else {
      payload = createAlertPayload(alertType, severity, message, details);
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

