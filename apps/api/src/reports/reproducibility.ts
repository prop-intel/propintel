/**
 * Reproducibility Scoring
 *
 * Tracks content stability over time and scores
 * how consistently the site maintains its content.
 */

import { type CrawledPage, type AEOAnalysis } from '../types';
import { type DiffReport } from './diff-generator';

// ===================
// Types
// ===================

export interface ReproducibilityScore {
  overall: number; // 0-100
  breakdown: {
    contentStability: number;
    structureStability: number;
    schemaStability: number;
    urlStability: number;
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
  insights: string[];
  recommendations: string[];
}

export interface HistoricalData {
  crawlDate: string;
  jobId: string;
  pageCount: number;
  aeoScore: number;
  pageHashes: Map<string, string>; // URL -> content hash
}

// ===================
// Main Functions
// ===================

/**
 * Calculate reproducibility score based on diff history
 */
export function calculateReproducibilityScore(
  diffReports: DiffReport[],
  currentPages: CrawledPage[]
): ReproducibilityScore {
  if (diffReports.length === 0) {
    return {
      overall: 100, // No history = assumed stable
      breakdown: {
        contentStability: 100,
        structureStability: 100,
        schemaStability: 100,
        urlStability: 100,
      },
      grade: 'A',
      trend: 'stable',
      insights: ['First crawl - no historical data for comparison'],
      recommendations: [],
    };
  }

  // Calculate component scores
  const contentStability = calculateContentStability(diffReports);
  const structureStability = calculateStructureStability(diffReports);
  const schemaStability = calculateSchemaStability(diffReports);
  const urlStability = calculateUrlStability(diffReports);

  // Weighted average
  const overall = Math.round(
    contentStability * 0.35 +
    structureStability * 0.25 +
    schemaStability * 0.25 +
    urlStability * 0.15
  );

  // Determine grade
  const grade = getGrade(overall);

  // Determine trend
  const trend = determineTrend(diffReports);

  // Generate insights
  const insights = generateInsights(diffReports, {
    contentStability,
    structureStability,
    schemaStability,
    urlStability,
  });

  // Generate recommendations
  const recommendations = generateRecommendations({
    contentStability,
    structureStability,
    schemaStability,
    urlStability,
  });

  return {
    overall,
    breakdown: {
      contentStability,
      structureStability,
      schemaStability,
      urlStability,
    },
    grade,
    trend,
    insights,
    recommendations,
  };
}

/**
 * Track content changes and store for future comparison
 */
export function createHistoricalSnapshot(
  pages: CrawledPage[],
  aeoAnalysis: AEOAnalysis,
  jobId: string
): HistoricalData {
  const pageHashes = new Map<string, string>();

  for (const page of pages) {
    const hash = generateContentHash(page);
    pageHashes.set(normalizeUrl(page.url), hash);
  }

  return {
    crawlDate: new Date().toISOString(),
    jobId,
    pageCount: pages.length,
    aeoScore: aeoAnalysis.visibilityScore,
    pageHashes,
  };
}

/**
 * Compare two snapshots for quick change detection
 */
export function compareSnapshots(
  current: HistoricalData,
  previous: HistoricalData
): {
  changedUrls: string[];
  addedUrls: string[];
  removedUrls: string[];
  changePercentage: number;
} {
  const currentUrls = new Set(current.pageHashes.keys());
  const previousUrls = new Set(previous.pageHashes.keys());

  const addedUrls: string[] = [];
  const removedUrls: string[] = [];
  const changedUrls: string[] = [];

  // Find added URLs
  for (const url of currentUrls) {
    if (!previousUrls.has(url)) {
      addedUrls.push(url);
    }
  }

  // Find removed URLs
  for (const url of previousUrls) {
    if (!currentUrls.has(url)) {
      removedUrls.push(url);
    }
  }

  // Find changed URLs
  for (const url of currentUrls) {
    if (previousUrls.has(url)) {
      const currentHash = current.pageHashes.get(url);
      const previousHash = previous.pageHashes.get(url);
      if (currentHash !== previousHash) {
        changedUrls.push(url);
      }
    }
  }

  const totalUrls = Math.max(currentUrls.size, previousUrls.size);
  const changePercentage = totalUrls > 0
    ? ((changedUrls.length + addedUrls.length + removedUrls.length) / totalUrls) * 100
    : 0;

  return {
    changedUrls,
    addedUrls,
    removedUrls,
    changePercentage,
  };
}

// ===================
// Scoring Functions
// ===================

/**
 * Calculate content stability score
 */
function calculateContentStability(diffReports: DiffReport[]): number {
  if (diffReports.length === 0) return 100;

  let totalChangeRatio = 0;

  for (const report of diffReports) {
    const totalPages = report.summary.pagesAdded + 
                       report.summary.pagesRemoved + 
                       report.summary.pagesModified + 
                       report.summary.pagesUnchanged;

    if (totalPages > 0) {
      // Weight: modifications are less severe than additions/removals
      const changeScore = 
        (report.summary.pagesModified * 0.3) + 
        (report.summary.pagesAdded * 0.5) + 
        (report.summary.pagesRemoved * 1.0);
      
      totalChangeRatio += changeScore / totalPages;
    }
  }

  const avgChangeRatio = totalChangeRatio / diffReports.length;
  
  // Convert to 0-100 score (lower change = higher stability)
  return Math.max(0, Math.round(100 - (avgChangeRatio * 100)));
}

/**
 * Calculate structure stability score
 */
function calculateStructureStability(diffReports: DiffReport[]): number {
  if (diffReports.length === 0) return 100;

  let structureChanges = 0;
  let totalPages = 0;

  for (const report of diffReports) {
    for (const diff of report.pageDiffs) {
      if (diff.changeType !== 'unchanged') {
        const hasStructureChange = diff.changes.some(c =>
          c.field === 'h1' || 
          c.field.startsWith('headings.') ||
          c.field === 'title'
        );
        if (hasStructureChange) {
          structureChanges++;
        }
      }
      totalPages++;
    }
  }

  if (totalPages === 0) return 100;

  const changeRatio = structureChanges / totalPages;
  return Math.max(0, Math.round(100 - (changeRatio * 200))); // Higher penalty for structure changes
}

/**
 * Calculate schema stability score
 */
function calculateSchemaStability(diffReports: DiffReport[]): number {
  if (diffReports.length === 0) return 100;

  let schemaChanges = 0;
  let totalPages = 0;

  for (const report of diffReports) {
    for (const diff of report.pageDiffs) {
      const hasSchemaChange = diff.changes.some(c => c.field.startsWith('schemas.'));
      if (hasSchemaChange) {
        schemaChanges++;
      }
      totalPages++;
    }
  }

  if (totalPages === 0) return 100;

  const changeRatio = schemaChanges / totalPages;
  return Math.max(0, Math.round(100 - (changeRatio * 150)));
}

/**
 * Calculate URL stability score
 */
function calculateUrlStability(diffReports: DiffReport[]): number {
  if (diffReports.length === 0) return 100;

  let urlChurn = 0;

  for (const report of diffReports) {
    const total = report.summary.pagesAdded + 
                  report.summary.pagesRemoved + 
                  report.summary.pagesModified + 
                  report.summary.pagesUnchanged;

    if (total > 0) {
      // URL churn = pages added or removed
      urlChurn += (report.summary.pagesAdded + report.summary.pagesRemoved) / total;
    }
  }

  const avgChurn = urlChurn / diffReports.length;
  return Math.max(0, Math.round(100 - (avgChurn * 150)));
}

// ===================
// Helper Functions
// ===================

/**
 * Get letter grade
 */
function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Determine trend from historical data
 */
function determineTrend(diffReports: DiffReport[]): 'improving' | 'stable' | 'declining' {
  if (diffReports.length < 2) return 'stable';

  // Look at recent AEO score changes
  const recentReports = diffReports.slice(-3);
  let scoreChanges = 0;

  for (const report of recentReports) {
    scoreChanges += report.aeoImpact.scoreChange;
  }

  if (scoreChanges > 5) return 'improving';
  if (scoreChanges < -5) return 'declining';
  return 'stable';
}

/**
 * Generate insights based on scores
 */
function generateInsights(
  diffReports: DiffReport[],
  scores: ReproducibilityScore['breakdown']
): string[] {
  const insights: string[] = [];

  // Overall stability
  const avgScore = (scores.contentStability + scores.structureStability + 
                    scores.schemaStability + scores.urlStability) / 4;
  
  if (avgScore >= 90) {
    insights.push('Content is highly stable - consistent for AI indexing');
  } else if (avgScore >= 70) {
    insights.push('Content is moderately stable with some regular updates');
  } else {
    insights.push('Content changes frequently - may affect AI caching');
  }

  // Specific insights
  if (scores.contentStability < 70) {
    insights.push('Frequent content changes detected - consider establishing a content calendar');
  }

  if (scores.structureStability < 70) {
    insights.push('Page structure changes often - may confuse AI understanding');
  }

  if (scores.schemaStability < 80) {
    insights.push('Schema markup is inconsistent - stabilize for better AI comprehension');
  }

  if (scores.urlStability < 80) {
    insights.push('URL structure changes detected - ensure redirects are in place');
  }

  // Trend insights
  if (diffReports.length >= 2) {
    const latestReport = diffReports[diffReports.length - 1];
    if (latestReport.summary.majorChanges > 5) {
      insights.push(`Recent major changes: ${latestReport.summary.majorChanges} significant updates`);
    }
  }

  return insights;
}

/**
 * Generate recommendations based on scores
 */
function generateRecommendations(
  scores: ReproducibilityScore['breakdown']
): string[] {
  const recommendations: string[] = [];

  if (scores.contentStability < 70) {
    recommendations.push('Consider implementing a content review process before publishing');
  }

  if (scores.structureStability < 70) {
    recommendations.push('Maintain consistent heading structure across updates');
  }

  if (scores.schemaStability < 80) {
    recommendations.push('Create schema templates to ensure consistency');
  }

  if (scores.urlStability < 80) {
    recommendations.push('Implement URL change tracking and redirect management');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current content management practices');
  }

  return recommendations;
}

/**
 * Generate a simple content hash for change detection
 */
function generateContentHash(page: CrawledPage): string {
  const content = [
    page.title || '',
    page.metaDescription || '',
    page.h1 || '',
    page.wordCount.toString(),
    page.schemas.map(s => s.type).sort().join(','),
    page.headings.h2.join(','),
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin.replace('www.', '') + 
           parsed.pathname.replace(/\/$/, '') + 
           parsed.search;
  } catch {
    return url.toLowerCase();
  }
}

