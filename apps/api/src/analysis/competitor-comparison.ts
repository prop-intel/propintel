/**
 * Competitor Comparison Analysis
 *
 * Side-by-side comparison of your site against competitors
 * for comprehensive competitive intelligence.
 */

import { type CrawledPage, type AEOAnalysis, type LLMEOAnalysis, type SEOAnalysis } from '../types';
import { type TemplateType, analyzeTemplateDistribution } from './template-detector';

// ===================
// Types
// ===================

export interface CompetitorData {
  domain: string;
  pages: CrawledPage[];
  aeoAnalysis?: AEOAnalysis;
  llmeoAnalysis?: LLMEOAnalysis;
  seoAnalysis?: SEOAnalysis;
  crawledAt: string;
}

export interface ComparisonReport {
  yourDomain: string;
  competitors: string[];
  generatedAt: string;
  
  // Score comparison
  scoreComparison: {
    domain: string;
    aeoScore: number;
    llmeoScore: number;
    seoScore: number;
    overallScore: number;
    rank: number;
  }[];

  // Category breakdown
  categoryComparison: {
    category: string;
    scores: { domain: string; score: number }[];
    winner: string;
    yourPosition: number;
  }[];

  // Content comparison
  contentComparison: {
    metric: string;
    values: { domain: string; value: number | string }[];
    insight: string;
  }[];

  // Template comparison
  templateComparison: {
    templateType: TemplateType;
    coverage: { domain: string; count: number; percentage: number }[];
  }[];

  // Strengths and weaknesses
  competitivePosition: {
    yourStrengths: string[];
    yourWeaknesses: string[];
    opportunityGaps: OpportunityGap[];
    threats: string[];
  };

  // Recommendations
  priorityActions: CompetitiveAction[];
}

export interface OpportunityGap {
  area: string;
  description: string;
  competitorExample: string;
  potentialImpact: 'high' | 'medium' | 'low';
}

export interface CompetitiveAction {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
}

// ===================
// Main Functions
// ===================

/**
 * Generate comprehensive competitor comparison report
 */
export function generateComparisonReport(
  yourData: CompetitorData,
  competitors: CompetitorData[]
): ComparisonReport {
  const allData = [yourData, ...competitors];

  // Generate score comparison
  const scoreComparison = generateScoreComparison(allData);

  // Generate category comparison
  const categoryComparison = generateCategoryComparison(allData);

  // Generate content comparison
  const contentComparison = generateContentComparison(allData);

  // Generate template comparison
  const templateComparison = generateTemplateComparison(allData);

  // Analyze competitive position
  const competitivePosition = analyzeCompetitivePosition(
    yourData,
    competitors,
    scoreComparison,
    categoryComparison
  );

  // Generate priority actions
  const priorityActions = generatePriorityActions(
    competitivePosition,
    contentComparison,
    templateComparison
  );

  return {
    yourDomain: yourData.domain,
    competitors: competitors.map(c => c.domain),
    generatedAt: new Date().toISOString(),
    scoreComparison,
    categoryComparison,
    contentComparison,
    templateComparison,
    competitivePosition,
    priorityActions,
  };
}

/**
 * Quick competitive overview without full analysis
 */
export function quickCompetitiveOverview(
  yourData: CompetitorData,
  competitors: CompetitorData[]
): {
  yourRank: number;
  totalCompetitors: number;
  aheadIn: string[];
  behindIn: string[];
  biggestGap: string;
} {
  const allData = [yourData, ...competitors];
  const scores = allData.map(d => ({
    domain: d.domain,
    score: d.aeoAnalysis?.visibilityScore || 0,
  })).sort((a, b) => b.score - a.score);

  const yourRank = scores.findIndex(s => s.domain === yourData.domain) + 1;

  const aheadIn: string[] = [];
  const behindIn: string[] = [];

  // Compare specific metrics
  for (const competitor of competitors) {
    // Schema comparison
    const yourSchemaCount = yourData.pages.reduce((sum, p) => sum + p.schemas.length, 0);
    const compSchemaCount = competitor.pages.reduce((sum, p) => sum + p.schemas.length, 0);
    if (yourSchemaCount > compSchemaCount && !aheadIn.includes('Schema markup')) {
      aheadIn.push('Schema markup');
    } else if (compSchemaCount > yourSchemaCount && !behindIn.includes('Schema markup')) {
      behindIn.push('Schema markup');
    }

    // Content depth comparison
    const yourAvgWords = yourData.pages.reduce((sum, p) => sum + p.wordCount, 0) / yourData.pages.length;
    const compAvgWords = competitor.pages.reduce((sum, p) => sum + p.wordCount, 0) / competitor.pages.length;
    if (yourAvgWords > compAvgWords * 1.2 && !aheadIn.includes('Content depth')) {
      aheadIn.push('Content depth');
    } else if (compAvgWords > yourAvgWords * 1.2 && !behindIn.includes('Content depth')) {
      behindIn.push('Content depth');
    }
  }

  // Find biggest gap
  let biggestGap = 'No significant gaps identified';
  if (behindIn.length > 0 && behindIn[0]) {
    biggestGap = behindIn[0];
  }

  return {
    yourRank,
    totalCompetitors: competitors.length + 1,
    aheadIn,
    behindIn,
    biggestGap,
  };
}

// ===================
// Comparison Functions
// ===================

/**
 * Generate score comparison
 */
function generateScoreComparison(
  allData: CompetitorData[]
): ComparisonReport['scoreComparison'] {
  const scores = allData.map(d => ({
    domain: d.domain,
    aeoScore: d.aeoAnalysis?.visibilityScore || 0,
    llmeoScore: d.llmeoAnalysis?.score || 0,
    seoScore: d.seoAnalysis?.score || 0,
    overallScore: calculateOverallScore(d),
    rank: 0,
  }));

  // Sort by overall score and assign ranks
  scores.sort((a, b) => b.overallScore - a.overallScore);
  scores.forEach((s, i) => s.rank = i + 1);

  return scores;
}

/**
 * Calculate overall score for a competitor
 */
function calculateOverallScore(data: CompetitorData): number {
  const aeo = data.aeoAnalysis?.visibilityScore || 0;
  const llmeo = data.llmeoAnalysis?.score || 0;
  const seo = data.seoAnalysis?.score || 0;

  // Weight: AEO 50%, LLMEO 30%, SEO 20%
  return Math.round(aeo * 0.5 + llmeo * 0.3 + seo * 0.2);
}

/**
 * Generate category-by-category comparison
 */
function generateCategoryComparison(
  allData: CompetitorData[]
): ComparisonReport['categoryComparison'] {
  const categories = [
    { name: 'Schema Markup', getter: (d: CompetitorData) => 
      d.llmeoAnalysis?.schemaAnalysis?.score || calculateSchemaScore(d.pages) },
    { name: 'Content Depth', getter: (d: CompetitorData) => 
      d.llmeoAnalysis?.contentDepth?.score || calculateContentScore(d.pages) },
    { name: 'Metadata Quality', getter: (d: CompetitorData) => 
      d.seoAnalysis?.metadata?.score || calculateMetadataScore(d.pages) },
    { name: 'Page Structure', getter: (d: CompetitorData) => 
      d.seoAnalysis?.structure?.score || calculateStructureScore(d.pages) },
    { name: 'AI Visibility', getter: (d: CompetitorData) => 
      d.aeoAnalysis?.visibilityScore || 0 },
  ];

  return categories.map(cat => {
    const scores = allData.map(d => ({
      domain: d.domain,
      score: cat.getter(d),
    })).sort((a, b) => b.score - a.score);

    const yourDomain = allData[0]?.domain ?? '';
    return {
      category: cat.name,
      scores,
      winner: scores[0]?.domain ?? '',
      yourPosition: scores.findIndex(s => s.domain === yourDomain) + 1,
    };
  });
}

/**
 * Generate content metrics comparison
 */
function generateContentComparison(
  allData: CompetitorData[]
): ComparisonReport['contentComparison'] {
  const metrics: ComparisonReport['contentComparison'] = [];

  // Average word count
  metrics.push({
    metric: 'Average Word Count',
    values: allData.map(d => ({
      domain: d.domain,
      value: Math.round(d.pages.reduce((sum, p) => sum + p.wordCount, 0) / d.pages.length),
    })),
    insight: 'Higher word count often correlates with better AI citations',
  });

  // Schema coverage
  metrics.push({
    metric: 'Pages with Schema',
    values: allData.map(d => ({
      domain: d.domain,
      value: `${Math.round((d.pages.filter(p => p.schemas.length > 0).length / d.pages.length) * 100)}%`,
    })),
    insight: 'Schema markup helps AI systems understand content',
  });

  // Page count
  metrics.push({
    metric: 'Total Pages',
    values: allData.map(d => ({
      domain: d.domain,
      value: d.pages.length,
    })),
    insight: 'More comprehensive sites often get more AI visibility',
  });

  // Average load time
  metrics.push({
    metric: 'Avg Load Time (ms)',
    values: allData.map(d => ({
      domain: d.domain,
      value: Math.round(d.pages.reduce((sum, p) => sum + p.loadTimeMs, 0) / d.pages.length),
    })),
    insight: 'Faster sites provide better crawling experience',
  });

  return metrics;
}

/**
 * Generate template distribution comparison
 */
function generateTemplateComparison(
  allData: CompetitorData[]
): ComparisonReport['templateComparison'] {
  const templateTypes: TemplateType[] = [
    'blog', 'article', 'product', 'landing', 'documentation',
    'homepage', 'category', 'faq', 'how-to', 'comparison'
  ];

  return templateTypes.map(type => ({
    templateType: type,
    coverage: allData.map(d => {
      const analysis = analyzeTemplateDistribution(d.pages);
      const count = analysis.distribution.get(type) || 0;
      return {
        domain: d.domain,
        count,
        percentage: Math.round((count / d.pages.length) * 100),
      };
    }),
  }));
}

/**
 * Analyze competitive position
 */
function analyzeCompetitivePosition(
  yourData: CompetitorData,
  competitors: CompetitorData[],
  scoreComparison: ComparisonReport['scoreComparison'],
  categoryComparison: ComparisonReport['categoryComparison']
): ComparisonReport['competitivePosition'] {
  const yourStrengths: string[] = [];
  const yourWeaknesses: string[] = [];
  const opportunityGaps: OpportunityGap[] = [];
  const threats: string[] = [];

  // Identify strengths (categories where you rank 1st or 2nd)
  for (const cat of categoryComparison) {
    if (cat.yourPosition === 1) {
      yourStrengths.push(`Leading in ${cat.category}`);
    } else if (cat.yourPosition === 2) {
      yourStrengths.push(`Strong in ${cat.category}`);
    } else if (cat.yourPosition >= competitors.length) {
      yourWeaknesses.push(`Lagging in ${cat.category}`);
    }
  }

  // Identify opportunity gaps
  for (const competitor of competitors) {
    // Check for content types they have that you don't
    const yourTemplates = analyzeTemplateDistribution(yourData.pages);
    const compTemplates = analyzeTemplateDistribution(competitor.pages);

    for (const [type, count] of compTemplates.distribution) {
      const yourCount = yourTemplates.distribution.get(type) || 0;
      if (count >= 3 && yourCount === 0) {
        opportunityGaps.push({
          area: `${type} content`,
          description: `${competitor.domain} has ${count} ${type} pages, you have none`,
          competitorExample: competitor.domain,
          potentialImpact: count >= 5 ? 'high' : 'medium',
        });
      }
    }

    // Check for schema types they use that you don't
    const yourSchemas = new Set(yourData.pages.flatMap(p => p.schemas.map(s => s.type)));
    const compSchemas = new Set(competitor.pages.flatMap(p => p.schemas.map(s => s.type)));
    
    for (const schema of compSchemas) {
      if (!yourSchemas.has(schema) && schema !== 'Unknown') {
        opportunityGaps.push({
          area: `${schema} schema`,
          description: `${competitor.domain} uses ${schema} schema, you don't`,
          competitorExample: competitor.domain,
          potentialImpact: 'medium',
        });
      }
    }
  }

  // Identify threats (competitors with higher scores and momentum)
  const yourScore = scoreComparison.find(s => s.domain === yourData.domain);
  for (const comp of competitors) {
    const compScore = scoreComparison.find(s => s.domain === comp.domain);
    if (compScore && yourScore && compScore.overallScore > yourScore.overallScore * 1.2) {
      threats.push(`${comp.domain} has significantly higher visibility (${compScore.overallScore} vs ${yourScore.overallScore})`);
    }
  }

  // Deduplicate gaps
  const uniqueGaps = opportunityGaps.filter((gap, index, self) =>
    index === self.findIndex(g => g.area === gap.area)
  );

  return {
    yourStrengths,
    yourWeaknesses,
    opportunityGaps: uniqueGaps.slice(0, 10),
    threats,
  };
}

/**
 * Generate priority actions based on analysis
 */
function generatePriorityActions(
  position: ComparisonReport['competitivePosition'],
  _contentComparison: ComparisonReport['contentComparison'],
  _templateComparison: ComparisonReport['templateComparison']
): CompetitiveAction[] {
  const actions: CompetitiveAction[] = [];

  // High priority: Address biggest weaknesses
  for (const weakness of position.yourWeaknesses.slice(0, 2)) {
    actions.push({
      priority: 'high',
      action: `Improve ${weakness.replace('Lagging in ', '')}`,
      rationale: weakness,
      effort: 'medium',
      expectedImpact: 'Close competitive gap in this area',
    });
  }

  // High priority: Address high-impact opportunity gaps
  for (const gap of position.opportunityGaps.filter(g => g.potentialImpact === 'high')) {
    actions.push({
      priority: 'high',
      action: `Add ${gap.area}`,
      rationale: gap.description,
      effort: 'high',
      expectedImpact: 'New content opportunity with proven competitor success',
    });
  }

  // Medium priority: Address medium-impact gaps
  for (const gap of position.opportunityGaps.filter(g => g.potentialImpact === 'medium').slice(0, 3)) {
    actions.push({
      priority: 'medium',
      action: `Consider adding ${gap.area}`,
      rationale: gap.description,
      effort: 'medium',
      expectedImpact: 'Incremental visibility improvement',
    });
  }

  // Low priority: Maintain strengths
  if (position.yourStrengths.length > 0) {
    actions.push({
      priority: 'low',
      action: 'Maintain competitive advantages',
      rationale: `Continue excelling in: ${position.yourStrengths.join(', ')}`,
      effort: 'low',
      expectedImpact: 'Protect current positioning',
    });
  }

  return actions.slice(0, 10);
}

// ===================
// Helper Functions
// ===================

function calculateSchemaScore(pages: CrawledPage[]): number {
  const pagesWithSchema = pages.filter(p => p.schemas.length > 0);
  return Math.round((pagesWithSchema.length / pages.length) * 100);
}

function calculateContentScore(pages: CrawledPage[]): number {
  const avgWords = pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length;
  // Score: 100 at 1500+ words, scaling down from there
  return Math.min(100, Math.round((avgWords / 1500) * 100));
}

function calculateMetadataScore(pages: CrawledPage[]): number {
  let score = 0;
  for (const page of pages) {
    if (page.title) score += 40;
    if (page.metaDescription) score += 40;
    if (page.metaDescription && page.metaDescription.length >= 100) score += 20;
  }
  return Math.round(score / pages.length);
}

function calculateStructureScore(pages: CrawledPage[]): number {
  let score = 0;
  for (const page of pages) {
    if (page.headings.h1.length === 1) score += 40;
    if (page.headings.h2.length >= 2) score += 30;
    if (page.headings.h3.length >= 1) score += 30;
  }
  return Math.round(score / pages.length);
}

