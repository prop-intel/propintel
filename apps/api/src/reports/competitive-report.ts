/**
 * Competitive Report Generator
 *
 * Generates comprehensive competitive analysis reports
 * combining comparison and gap analysis.
 */

import { type ComparisonReport } from '../analysis/competitor-comparison';
import { type GapAnalysisResult } from '../analysis/gap-analysis';

// ===================
// Types
// ===================

export interface CompetitiveReport {
  meta: {
    generatedAt: string;
    yourDomain: string;
    competitorCount: number;
    pagesAnalyzed: number;
  };
  executiveSummary: ExecutiveSummary;
  comparison: ComparisonReport;
  gapAnalysis: GapAnalysisResult;
  actionPlan: ActionPlan;
}

export interface ExecutiveSummary {
  yourRank: number;
  totalCompetitors: number;
  overallScore: number;
  keyStrengths: string[];
  keyWeaknesses: string[];
  topOpportunity: string;
  biggestThreat: string;
  recommendation: string;
}

export interface ActionPlan {
  immediate: ActionItem[]; // Do this week
  shortTerm: ActionItem[]; // Do this month
  longTerm: ActionItem[]; // Do this quarter
}

export interface ActionItem {
  action: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  metrics: string[];
}

// ===================
// Main Functions
// ===================

/**
 * Generate comprehensive competitive report
 */
export function generateCompetitiveReport(
  comparison: ComparisonReport,
  gapAnalysis: GapAnalysisResult,
  pagesAnalyzed: number
): CompetitiveReport {
  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(comparison, gapAnalysis);

  // Generate action plan
  const actionPlan = generateActionPlan(comparison, gapAnalysis);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      yourDomain: comparison.yourDomain,
      competitorCount: comparison.competitors.length,
      pagesAnalyzed,
    },
    executiveSummary,
    comparison,
    gapAnalysis,
    actionPlan,
  };
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(
  comparison: ComparisonReport,
  gapAnalysis: GapAnalysisResult
): ExecutiveSummary {
  const yourScore = comparison.scoreComparison.find(s => s.domain === comparison.yourDomain);
  const yourRank = yourScore?.rank || comparison.scoreComparison.length;

  // Get strengths and weaknesses
  const keyStrengths = comparison.competitivePosition.yourStrengths.slice(0, 3);
  const keyWeaknesses = comparison.competitivePosition.yourWeaknesses.slice(0, 3);

  // Find top opportunity
  const topOpportunity = gapAnalysis.recommendations[0]?.title || 
    comparison.competitivePosition.opportunityGaps[0]?.area ||
    'No immediate opportunities identified';

  // Find biggest threat
  const biggestThreat = comparison.competitivePosition.threats[0] ||
    'No immediate threats identified';

  // Generate recommendation
  const recommendation = generateTopRecommendation(comparison, gapAnalysis);

  return {
    yourRank,
    totalCompetitors: comparison.competitors.length + 1,
    overallScore: yourScore?.overallScore || 0,
    keyStrengths,
    keyWeaknesses,
    topOpportunity,
    biggestThreat,
    recommendation,
  };
}

/**
 * Generate top recommendation
 */
function generateTopRecommendation(
  comparison: ComparisonReport,
  gapAnalysis: GapAnalysisResult
): string {
  // If there are critical schema gaps, prioritize those
  const criticalSchemaGaps = gapAnalysis.schemaGaps.filter(g => g.importance === 'critical');
  if (criticalSchemaGaps.length > 0) {
    return `Priority: Implement ${criticalSchemaGaps[0].schemaType} schema to enable AI-rich results`;
  }

  // If ranking is low, focus on biggest gap
  const yourScore = comparison.scoreComparison.find(s => s.domain === comparison.yourDomain);
  if (yourScore && yourScore.rank > Math.ceil(comparison.scoreComparison.length / 2)) {
    return `Focus on ${comparison.competitivePosition.yourWeaknesses[0] || 'improving overall visibility'} to climb competitive rankings`;
  }

  // If doing well, focus on opportunities
  if (comparison.competitivePosition.opportunityGaps.length > 0) {
    const topGap = comparison.competitivePosition.opportunityGaps[0];
    return `Opportunity: Add ${topGap.area} - competitors have proven this works`;
  }

  return 'Maintain current strengths while monitoring competitor movements';
}

/**
 * Generate prioritized action plan
 */
function generateActionPlan(
  comparison: ComparisonReport,
  gapAnalysis: GapAnalysisResult
): ActionPlan {
  const immediate: ActionItem[] = [];
  const shortTerm: ActionItem[] = [];
  const longTerm: ActionItem[] = [];

  // Immediate: Quick wins (low effort, any impact)
  for (const rec of gapAnalysis.recommendations.filter(r => r.effort === 'low')) {
    immediate.push({
      action: rec.title,
      rationale: rec.description,
      effort: 'low',
      impact: rec.estimatedImpact,
      metrics: ['Schema adoption rate', 'Rich result eligibility'],
    });
    if (immediate.length >= 3) break;
  }

  // Add any easy schema fixes
  for (const gap of gapAnalysis.schemaGaps.filter(g => g.importance === 'critical')) {
    if (!immediate.some(i => i.action.includes(gap.schemaType))) {
      immediate.push({
        action: `Add ${gap.schemaType} schema`,
        rationale: `${gap.competitorUsage.length} competitors use this schema`,
        effort: 'low',
        impact: 'high',
        metrics: ['Schema validation', 'Search feature eligibility'],
      });
    }
    if (immediate.length >= 5) break;
  }

  // Short term: Medium effort items with high impact
  for (const action of comparison.priorityActions.filter(a => 
    a.priority === 'high' && a.effort !== 'high'
  )) {
    shortTerm.push({
      action: action.action,
      rationale: action.rationale,
      effort: action.effort,
      impact: 'high',
      metrics: ['Visibility score', 'Citation rate'],
    });
    if (shortTerm.length >= 5) break;
  }

  // Add content gaps
  for (const gap of gapAnalysis.contentGaps.filter(g => g.priority === 'high')) {
    if (!shortTerm.some(s => s.action.includes(gap.type))) {
      shortTerm.push({
        action: gap.suggestedAction,
        rationale: gap.description,
        effort: 'medium',
        impact: 'high',
        metrics: ['Page count', 'Content coverage'],
      });
    }
    if (shortTerm.length >= 5) break;
  }

  // Long term: Strategic initiatives
  for (const gap of comparison.competitivePosition.opportunityGaps.filter(g => 
    g.potentialImpact === 'high'
  )) {
    longTerm.push({
      action: `Develop ${gap.area} strategy`,
      rationale: gap.description,
      effort: 'high',
      impact: 'high',
      metrics: ['New content sections', 'Competitive ranking'],
    });
    if (longTerm.length >= 3) break;
  }

  // Add feature development
  for (const feature of gapAnalysis.featureGaps.filter(g => 
    g.implementationEffort === 'high' || g.yourStatus === 'missing'
  )) {
    longTerm.push({
      action: `Build ${feature.feature}`,
      rationale: feature.expectedImpact,
      effort: feature.implementationEffort,
      impact: 'medium',
      metrics: ['Feature completion', 'User engagement'],
    });
    if (longTerm.length >= 5) break;
  }

  return { immediate, shortTerm, longTerm };
}

/**
 * Generate markdown version of competitive report
 */
export function generateCompetitiveReportMarkdown(report: CompetitiveReport): string {
  const lines: string[] = [];

  // Header
  lines.push('# Competitive Analysis Report');
  lines.push('');
  lines.push(`**Domain:** ${report.meta.yourDomain}`);
  lines.push(`**Generated:** ${report.meta.generatedAt}`);
  lines.push(`**Competitors Analyzed:** ${report.meta.competitorCount}`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`**Your Rank:** ${report.executiveSummary.yourRank} of ${report.executiveSummary.totalCompetitors}`);
  lines.push(`**Overall Score:** ${report.executiveSummary.overallScore}/100`);
  lines.push('');
  
  if (report.executiveSummary.keyStrengths.length > 0) {
    lines.push('**Key Strengths:**');
    report.executiveSummary.keyStrengths.forEach(s => lines.push(`- ${s}`));
    lines.push('');
  }

  if (report.executiveSummary.keyWeaknesses.length > 0) {
    lines.push('**Key Weaknesses:**');
    report.executiveSummary.keyWeaknesses.forEach(w => lines.push(`- ${w}`));
    lines.push('');
  }

  lines.push(`**Top Opportunity:** ${report.executiveSummary.topOpportunity}`);
  lines.push(`**Primary Recommendation:** ${report.executiveSummary.recommendation}`);
  lines.push('');

  // Score Comparison
  lines.push('## Score Comparison');
  lines.push('');
  lines.push('| Rank | Domain | AEO | LLMEO | SEO | Overall |');
  lines.push('|------|--------|-----|-------|-----|---------|');
  for (const score of report.comparison.scoreComparison) {
    const marker = score.domain === report.meta.yourDomain ? '**' : '';
    lines.push(`| ${score.rank} | ${marker}${score.domain}${marker} | ${score.aeoScore} | ${score.llmeoScore} | ${score.seoScore} | ${score.overallScore} |`);
  }
  lines.push('');

  // Gap Summary
  lines.push('## Gap Analysis Summary');
  lines.push('');
  lines.push(`- **Total Gaps Found:** ${report.gapAnalysis.summary.totalGaps}`);
  lines.push(`- **High Priority:** ${report.gapAnalysis.summary.highPriorityGaps}`);
  lines.push(`- **Quick Wins:** ${report.gapAnalysis.summary.quickWins}`);
  lines.push(`- **Competitive Readiness:** ${report.gapAnalysis.summary.competitiveReadiness}%`);
  lines.push('');

  // Action Plan
  lines.push('## Action Plan');
  lines.push('');

  if (report.actionPlan.immediate.length > 0) {
    lines.push('### Immediate (This Week)');
    report.actionPlan.immediate.forEach((action, i) => {
      lines.push(`${i + 1}. **${action.action}**`);
      lines.push(`   - ${action.rationale}`);
      lines.push(`   - Effort: ${action.effort} | Impact: ${action.impact}`);
    });
    lines.push('');
  }

  if (report.actionPlan.shortTerm.length > 0) {
    lines.push('### Short Term (This Month)');
    report.actionPlan.shortTerm.forEach((action, i) => {
      lines.push(`${i + 1}. **${action.action}**`);
      lines.push(`   - ${action.rationale}`);
    });
    lines.push('');
  }

  if (report.actionPlan.longTerm.length > 0) {
    lines.push('### Long Term (This Quarter)');
    report.actionPlan.longTerm.forEach((action, i) => {
      lines.push(`${i + 1}. **${action.action}**`);
      lines.push(`   - ${action.rationale}`);
    });
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*Generated by PropIntel Competitive Analysis*');

  return lines.join('\n');
}

