/**
 * Report Generator Agent
 *
 * Generates the final AEO report by merging AEO analysis
 * with existing LLMEO/SEO analysis.
 */

import {
  type AEOReport,
  type AEOAnalysis,
  type AEORecommendation,
  type CursorPrompt,
  type LLMEOAnalysis,
  type SEOAnalysis,
  type Report,
  type CrawledPage,
} from '../../types';
import { createTrace, flushLangfuse } from '../../lib/langfuse';

// ===================
// Score Weights
// ===================

// AEO is now the primary metric
const SCORE_WEIGHTS = {
  aeo: 0.50,     // 50% weight for AEO visibility
  llmeo: 0.30,   // 30% weight for LLMEO
  seo: 0.20,     // 20% weight for SEO
};

// ===================
// Main Function
// ===================

/**
 * Generate the complete AEO report
 */
export async function generateAEOReport(
  jobId: string,
  tenantId: string,
  domain: string,
  pages: CrawledPage[],
  aeoAnalysis: AEOAnalysis,
  aeoRecommendations: AEORecommendation[],
  cursorPrompt: CursorPrompt,
  llmeoAnalysis: LLMEOAnalysis,
  seoAnalysis: SEOAnalysis,
  existingReport: Partial<Report> = {}
): Promise<AEOReport> {
  const trace = createTrace({
    name: 'aeo-report-generation',
    userId: tenantId,
    metadata: { jobId, domain },
  });

  const span = trace.span({
    name: 'generate-report',
  });

  try {
    // Calculate combined overall score (AEO-weighted)
    const overallScore = calculateOverallScore(
      aeoAnalysis.visibilityScore,
      llmeoAnalysis.score,
      seoAnalysis.score
    );

    // Calculate confidence based on data quality
    const confidence = calculateConfidence(
      pages.length,
      aeoAnalysis.queriesAnalyzed,
      aeoAnalysis.citationRate
    );

    // Build the report
    const report: AEOReport = {
      meta: {
        jobId,
        userId: tenantId, // tenantId is now userId
        tenantId, // Keep for backward compatibility
        domain,
        generatedAt: new Date().toISOString(),
        pagesAnalyzed: pages.length,
        crawlDuration: existingReport.meta?.crawlDuration || 0,
      },
      scores: {
        aeoVisibilityScore: aeoAnalysis.visibilityScore, // PRIMARY
        llmeoScore: llmeoAnalysis.score,
        seoScore: seoAnalysis.score,
        overallScore,
        confidence,
      },
      aeoAnalysis,
      aeoRecommendations,
      cursorPrompt,
      llmeoAnalysis,
      seoAnalysis,
      recommendations: existingReport.recommendations || [],
      llmSummary: existingReport.llmSummary || {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        nextSteps: [],
      },
      copyReadyPrompt: cursorPrompt.prompt, // Use AEO cursor prompt
      promptVersion: cursorPrompt.version,
      warnings: existingReport.warnings || [],
      artifacts: {
        rawSnapshots: pages.filter(p => p.htmlSnapshot).map(p => p.htmlSnapshot!),
        extractedData: `${tenantId}/${jobId}/data/pages.json`,
        fullReport: `${tenantId}/${jobId}/reports/report.json`,
      },
    };

    span.end({
      output: {
        overallScore,
        aeoScore: aeoAnalysis.visibilityScore,
        recommendationCount: aeoRecommendations.length,
      },
    });

    await flushLangfuse();

    return report;
  } catch (error) {
    span.end({
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await flushLangfuse();
    throw error;
  }
}

/**
 * Generate markdown version of the report
 */
export function generateMarkdownReport(report: AEOReport): string {
  const md: string[] = [];

  // Header
  md.push(`# AEO Analysis Report: ${report.meta.domain}`);
  md.push(`Generated: ${report.meta.generatedAt}`);
  md.push('');

  // Executive Summary
  md.push('## Executive Summary');
  md.push('');
  md.push(`| Metric | Score | Grade |`);
  md.push(`|--------|-------|-------|`);
  md.push(`| **AEO Visibility** | ${report.scores.aeoVisibilityScore}/100 | ${getGrade(report.scores.aeoVisibilityScore)} |`);
  md.push(`| LLMEO Score | ${report.scores.llmeoScore}/100 | ${getGrade(report.scores.llmeoScore)} |`);
  md.push(`| SEO Score | ${report.scores.seoScore}/100 | ${getGrade(report.scores.seoScore)} |`);
  md.push(`| **Overall** | ${report.scores.overallScore}/100 | ${getGrade(report.scores.overallScore)} |`);
  md.push('');

  // Key Findings
  md.push('## Key Findings');
  md.push('');
  report.aeoAnalysis.keyFindings.forEach(finding => {
    md.push(`- ${finding}`);
  });
  md.push('');

  // Visibility Analysis
  md.push('## AEO Visibility Analysis');
  md.push('');
  md.push(`**Queries Analyzed:** ${report.aeoAnalysis.queriesAnalyzed}`);
  md.push(`**Citation Rate:** ${Math.round(report.aeoAnalysis.citationRate)}%`);
  md.push('');

  if (report.aeoAnalysis.topPerformingQueries.length > 0) {
    md.push('### Top Performing Queries');
    report.aeoAnalysis.topPerformingQueries.forEach(q => {
      md.push(`- ${q}`);
    });
    md.push('');
  }

  if (report.aeoAnalysis.missedOpportunities.length > 0) {
    md.push('### Missed Opportunities');
    report.aeoAnalysis.missedOpportunities.forEach(q => {
      md.push(`- ${q}`);
    });
    md.push('');
  }

  // Competitors
  if (report.aeoAnalysis.competitors.length > 0) {
    md.push('## Competitor Analysis');
    md.push('');
    md.push('| Domain | Citation Rate | Avg Rank |');
    md.push('|--------|---------------|----------|');
    report.aeoAnalysis.competitors.slice(0, 5).forEach(c => {
      md.push(`| ${c.domain} | ${Math.round(c.citationRate)}% | ${c.averageRank.toFixed(1)} |`);
    });
    md.push('');
  }

  // Recommendations
  md.push('## AEO Recommendations');
  md.push('');
  
  const highPriority = report.aeoRecommendations.filter(r => r.priority === 'high');
  const mediumPriority = report.aeoRecommendations.filter(r => r.priority === 'medium');
  
  if (highPriority.length > 0) {
    md.push('### High Priority');
    highPriority.forEach((r, i) => {
      md.push(`**${i + 1}. ${r.title}**`);
      md.push(r.description);
      if (r.competitorExample) {
        md.push(`> Reference: ${r.competitorExample.domain} - ${r.competitorExample.whatTheyDoBetter}`);
      }
      md.push('');
    });
  }

  if (mediumPriority.length > 0) {
    md.push('### Medium Priority');
    mediumPriority.forEach((r, i) => {
      md.push(`**${i + 1}. ${r.title}**`);
      md.push(r.description);
      md.push('');
    });
  }

  // Cursor Prompt
  md.push('## Ready-to-Use Cursor Prompt');
  md.push('');
  md.push('Copy the following prompt into Cursor to implement the recommended changes:');
  md.push('');
  md.push('```');
  md.push(report.cursorPrompt.prompt);
  md.push('```');
  md.push('');

  // Footer
  md.push('---');
  md.push(`*Report generated by PropIntel AEO Analyzer*`);
  md.push(`*Pages analyzed: ${report.meta.pagesAnalyzed} | Confidence: ${Math.round(report.scores.confidence * 100)}%*`);

  return md.join('\n');
}

// ===================
// Helper Functions
// ===================

/**
 * Calculate overall score with AEO weighting
 */
function calculateOverallScore(
  aeoScore: number,
  llmeoScore: number,
  seoScore: number
): number {
  return Math.round(
    aeoScore * SCORE_WEIGHTS.aeo +
    llmeoScore * SCORE_WEIGHTS.llmeo +
    seoScore * SCORE_WEIGHTS.seo
  );
}

/**
 * Calculate confidence score
 */
function calculateConfidence(
  pagesCount: number,
  queriesAnalyzed: number,
  citationRate: number
): number {
  // More pages = higher confidence (max at 20 pages)
  const pagesFactor = Math.min(pagesCount / 20, 1);
  
  // More queries = higher confidence (max at 10 queries)
  const queriesFactor = Math.min(queriesAnalyzed / 10, 1);
  
  // Some citations = higher confidence
  const citationFactor = citationRate > 0 ? Math.min(citationRate / 50, 1) : 0.5;
  
  return Math.round((pagesFactor * 0.3 + queriesFactor * 0.4 + citationFactor * 0.3) * 100) / 100;
}

/**
 * Get letter grade for score
 */
function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

