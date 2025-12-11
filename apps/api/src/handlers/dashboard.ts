/**
 * Dashboard API Handlers
 *
 * Provides dashboard endpoints for metrics, trends, and summaries.
 */

import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { listJobsForUser } from '../lib/db';
import { getReport } from '../lib/s3';
import { validateRequest } from '../lib/auth';
import { type ApiResponse, type AEOReport } from '../types';
import type { Job } from '@propintel/database';

// ===================
// Types
// ===================

interface DashboardSummary {
  overview: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageScore: number;
    scoreChange: number;
  };
  recentJobs: {
    jobId: string;
    domain: string;
    status: string;
    aeoScore: number;
    completedAt: string;
  }[];
  topDomains: {
    domain: string;
    jobCount: number;
    latestScore: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  alerts: DashboardAlert[];
}

interface DashboardAlert {
  type: 'score_drop' | 'new_competitor' | 'gap_identified' | 'error';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  domain?: string;
  createdAt: string;
}

interface TrendData {
  date: string;
  aeoScore: number;
  llmeoScore: number;
  seoScore: number;
  citationRate: number;
}

// ===================
// Handlers
// ===================

/**
 * GET /dashboard/summary
 * Get overall dashboard summary
 */
export const getSummary: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const authResult = await validateRequest(event);
    if (!authResult.success) {
      return formatResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: authResult.error || 'Unauthorized' },
      });
    }

    const userId = authResult.userId;

    // Get recent jobs
    const jobs = await listJobsForUser(userId, 50);
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const failedJobs = jobs.filter(j => j.status === 'failed' || j.status === 'blocked');

    // Calculate averages and trends
    const recentScores: number[] = [];
    const domainMap = new Map<string, { jobs: Job[]; scores: number[] }>();

    for (const job of completedJobs.slice(0, 20)) {
      try {
        const reportJson = await getReport(userId, job.id, 'json');
        if (reportJson) {
          const report = JSON.parse(reportJson) as AEOReport;
          if (report.scores?.aeoVisibilityScore) {
            recentScores.push(report.scores.aeoVisibilityScore);

            const domain = new URL(job.targetUrl).hostname;
            if (!domainMap.has(domain)) {
              domainMap.set(domain, { jobs: [], scores: [] });
            }
            domainMap.get(domain)!.jobs.push(job);
            domainMap.get(domain)!.scores.push(report.scores.aeoVisibilityScore);
          }
        }
      } catch {
        // Skip jobs without reports
      }
    }

    const averageScore = recentScores.length > 0
      ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
      : 0;

    // Calculate score change (last 5 vs previous 5)
    let scoreChange = 0;
    if (recentScores.length >= 10) {
      const recent = recentScores.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const previous = recentScores.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
      scoreChange = Math.round(recent - previous);
    }

    // Build recent jobs list
    const recentJobsList = await Promise.all(
      completedJobs.slice(0, 5).map(async (job) => {
        let aeoScore = 0;
        try {
          const reportJson = await getReport(userId, job.id, 'json');
          if (reportJson) {
            const report = JSON.parse(reportJson) as AEOReport;
            aeoScore = report.scores?.aeoVisibilityScore || 0;
          }
        } catch {}

        return {
          jobId: job.id,
          domain: new URL(job.targetUrl).hostname,
          status: job.status,
          aeoScore,
          completedAt: job.metrics?.completedAt || job.updatedAt.toISOString(),
        };
      })
    );

    // Build top domains list
    const topDomains = [...domainMap.entries()]
      .map(([domain, data]) => {
        const scores = data.scores;
        const score0 = scores[0] ?? 0;
        const score1 = scores[1] ?? 0;
        const trend: 'up' | 'down' | 'stable' =
          scores.length >= 2 && score0 > score1 ? 'up' :
          scores.length >= 2 && score0 < score1 ? 'down' : 'stable';

        return {
          domain,
          jobCount: data.jobs.length,
          latestScore: score0,
          trend,
        };
      })
      .sort((a, b) => b.latestScore - a.latestScore)
      .slice(0, 5);

    // Generate alerts
    const alerts = generateAlerts(jobs, domainMap);

    const summary: DashboardSummary = {
      overview: {
        totalJobs: jobs.length,
        completedJobs: completedJobs.length,
        failedJobs: failedJobs.length,
        averageScore,
        scoreChange,
      },
      recentJobs: recentJobsList,
      topDomains,
      alerts,
    };

    return formatResponse(200, {
      success: true,
      data: summary,
      meta: { requestId: event.requestContext?.requestId, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return formatResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate dashboard summary' },
    });
  }
};

/**
 * GET /dashboard/trends
 * Get score trends over time
 */
export const getTrends: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const authResult = await validateRequest(event);
    if (!authResult.success) {
      return formatResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: authResult.error || 'Unauthorized' },
      });
    }

    const userId = authResult.userId;
    const domain = event.queryStringParameters?.domain;
    const days = parseInt(event.queryStringParameters?.days || '30');

    // Get jobs for the period
    const jobs = await listJobsForUser(userId, 100);
    const completedJobs = jobs.filter(j => j.status === 'completed');

    // Filter by domain if specified
    const filteredJobs = domain
      ? completedJobs.filter(j => new URL(j.targetUrl).hostname === domain)
      : completedJobs;

    // Get trend data
    const trends: TrendData[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    for (const job of filteredJobs) {
      const completedAt = new Date(job.metrics?.completedAt || job.updatedAt);
      if (completedAt < cutoffDate) continue;

      try {
        const reportJson = await getReport(userId, job.id, 'json');
        if (reportJson) {
          const report = JSON.parse(reportJson) as AEOReport;
          trends.push({
            date: completedAt.toISOString().split('T')[0] ?? '',
            aeoScore: report.scores?.aeoVisibilityScore || 0,
            llmeoScore: report.scores?.llmeoScore || 0,
            seoScore: report.scores?.seoScore || 0,
            citationRate: report.aeoAnalysis?.citationRate || 0,
          });
        }
      } catch {
        // Skip jobs without valid reports
      }
    }

    // Sort by date
    trends.sort((a, b) => a.date.localeCompare(b.date));

    return formatResponse(200, {
      success: true,
      data: {
        domain: domain || 'all',
        period: `${days} days`,
        trends,
      },
      meta: { requestId: event.requestContext?.requestId, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Dashboard trends error:', error);
    return formatResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get trends' },
    });
  }
};

/**
 * GET /alerts
 * Get active alerts
 */
export const getAlerts: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const authResult = await validateRequest(event);
    if (!authResult.success) {
      return formatResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: authResult.error || 'Unauthorized' },
      });
    }

    const userId = authResult.userId;

    // Get recent jobs to generate alerts
    const jobs = await listJobsForUser(userId, 20);
    
    const domainMap = new Map<string, { jobs: Job[]; scores: number[] }>();

    for (const job of jobs.filter(j => j.status === 'completed').slice(0, 10)) {
      try {
        const reportJson = await getReport(userId, job.id, 'json');
        if (reportJson) {
          const report = JSON.parse(reportJson) as AEOReport;
          if (report.scores?.aeoVisibilityScore) {
            const domain = new URL(job.targetUrl).hostname;
            if (!domainMap.has(domain)) {
              domainMap.set(domain, { jobs: [], scores: [] });
            }
            domainMap.get(domain)!.jobs.push(job);
            domainMap.get(domain)!.scores.push(report.scores.aeoVisibilityScore);
          }
        }
      } catch {}
    }

    const alerts = generateAlerts(jobs, domainMap);

    return formatResponse(200, {
      success: true,
      data: { alerts },
      meta: { requestId: event.requestContext?.requestId, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Alerts error:', error);
    return formatResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get alerts' },
    });
  }
};

// ===================
// Helper Functions
// ===================

function generateAlerts(
  jobs: Job[],
  domainMap: Map<string, { jobs: Job[]; scores: number[] }>
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  // Check for recent failures
  const recentFailures = jobs.filter(
    j => (j.status === 'failed' || j.status === 'blocked') && 
    j.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  
  if (recentFailures.length > 0) {
    alerts.push({
      type: 'error',
      severity: 'warning',
      message: `${recentFailures.length} job(s) failed in the last 24 hours`,
      createdAt: new Date().toISOString(),
    });
  }

  // Check for score drops
  for (const [domain, data] of domainMap) {
    if (data.scores.length >= 2) {
      const score0 = data.scores[0] ?? 0;
      const score1 = data.scores[1] ?? 0;
      const scoreDrop = score1 - score0;
      if (scoreDrop >= 10) {
        alerts.push({
          type: 'score_drop',
          severity: scoreDrop >= 20 ? 'critical' : 'warning',
          message: `${domain} AEO score dropped by ${scoreDrop} points`,
          domain,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // Check for low scores
  for (const [domain, data] of domainMap) {
    const firstScore = data.scores[0];
    if (firstScore !== undefined && firstScore < 30) {
      alerts.push({
        type: 'gap_identified',
        severity: 'warning',
        message: `${domain} has low AEO visibility (${firstScore}/100)`,
        domain,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alerts.slice(0, 10);
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
