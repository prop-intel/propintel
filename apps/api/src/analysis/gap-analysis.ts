/**
 * Gap Analysis
 *
 * Identifies content gaps, keyword gaps, and feature gaps
 * compared to competitors.
 */

import { type CrawledPage, type AEOAnalysis, type QueryGap } from '../types';
import { type TemplateType, detectTemplate } from './template-detector';

// ===================
// Types
// ===================

export interface GapAnalysisResult {
  contentGaps: ContentGap[];
  keywordGaps: KeywordGap[];
  featureGaps: FeatureGap[];
  schemaGaps: SchemaGap[];
  summary: GapSummary;
  recommendations: GapRecommendation[];
}

export interface ContentGap {
  type: 'topic' | 'depth' | 'format' | 'freshness';
  description: string;
  competitorExample: {
    domain: string;
    url: string;
    title: string;
  };
  yourCoverage: 'none' | 'partial' | 'outdated';
  priority: 'high' | 'medium' | 'low';
  suggestedAction: string;
}

export interface KeywordGap {
  keyword: string;
  competitorRanking: {
    domain: string;
    position: number;
  }[];
  yourPosition: number | null;
  searchVolumeTier: 'high' | 'medium' | 'low' | 'unknown';
  difficulty: 'easy' | 'medium' | 'hard';
  opportunity: string;
}

export interface FeatureGap {
  feature: string;
  description: string;
  competitorsHaving: string[];
  yourStatus: 'missing' | 'partial' | 'present';
  implementationEffort: 'low' | 'medium' | 'high';
  expectedImpact: string;
}

export interface SchemaGap {
  schemaType: string;
  competitorUsage: { domain: string; pageCount: number }[];
  yourUsage: number;
  importance: 'critical' | 'recommended' | 'optional';
  recommendation: string;
}

export interface GapSummary {
  totalGaps: number;
  highPriorityGaps: number;
  quickWins: number;
  contentCoverage: number; // 0-100
  schemaCoverage: number; // 0-100
  competitiveReadiness: number; // 0-100
}

export interface GapRecommendation {
  priority: number;
  title: string;
  description: string;
  relatedGaps: string[];
  estimatedImpact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short-term' | 'long-term';
}

// ===================
// Main Functions
// ===================

/**
 * Perform comprehensive gap analysis
 */
export function analyzeGaps(
  yourPages: CrawledPage[],
  competitorPages: Map<string, CrawledPage[]>,
  aeoAnalysis: AEOAnalysis,
  queryGaps: QueryGap[]
): GapAnalysisResult {
  // Analyze content gaps
  const contentGaps = identifyContentGaps(yourPages, competitorPages);

  // Analyze keyword gaps from AEO analysis
  const keywordGaps = identifyKeywordGaps(queryGaps, competitorPages);

  // Analyze feature gaps
  const featureGaps = identifyFeatureGaps(yourPages, competitorPages);

  // Analyze schema gaps
  const schemaGaps = identifySchemaGaps(yourPages, competitorPages);

  // Calculate summary
  const summary = calculateGapSummary(contentGaps, keywordGaps, featureGaps, schemaGaps);

  // Generate recommendations
  const recommendations = generateGapRecommendations(
    contentGaps,
    keywordGaps,
    featureGaps,
    schemaGaps
  );

  return {
    contentGaps,
    keywordGaps,
    featureGaps,
    schemaGaps,
    summary,
    recommendations,
  };
}

// ===================
// Gap Identification
// ===================

/**
 * Identify content gaps
 */
function identifyContentGaps(
  yourPages: CrawledPage[],
  competitorPages: Map<string, CrawledPage[]>
): ContentGap[] {
  const gaps: ContentGap[] = [];

  // Analyze your content types
  const yourTemplates = new Map<TemplateType, CrawledPage[]>();
  for (const page of yourPages) {
    const template = detectTemplate(page);
    if (!yourTemplates.has(template.type)) {
      yourTemplates.set(template.type, []);
    }
    yourTemplates.get(template.type)!.push(page);
  }

  // Compare against competitors
  for (const [domain, pages] of competitorPages) {
    for (const page of pages) {
      const template = detectTemplate(page);
      const yourPagesOfType = yourTemplates.get(template.type) || [];

      // Check if competitor has content type you don't
      if (yourPagesOfType.length === 0 && template.confidence > 50) {
        gaps.push({
          type: 'topic',
          description: `Competitor has ${template.type} content you lack`,
          competitorExample: {
            domain,
            url: page.url,
            title: page.title || 'Untitled',
          },
          yourCoverage: 'none',
          priority: template.type === 'faq' || template.type === 'how-to' ? 'high' : 'medium',
          suggestedAction: `Create ${template.type} content covering similar topics`,
        });
      }

      // Check for content depth gaps
      const similarYourPage = findSimilarPage(page, yourPagesOfType);
      if (similarYourPage && page.wordCount > similarYourPage.wordCount * 1.5) {
        gaps.push({
          type: 'depth',
          description: `Competitor's content is ${Math.round((page.wordCount / similarYourPage.wordCount - 1) * 100)}% more comprehensive`,
          competitorExample: {
            domain,
            url: page.url,
            title: page.title || 'Untitled',
          },
          yourCoverage: 'partial',
          priority: 'medium',
          suggestedAction: `Expand content to match or exceed ${page.wordCount} words`,
        });
      }
    }
  }

  // Deduplicate by type
  const uniqueGaps = deduplicateGaps(gaps);

  return uniqueGaps.slice(0, 15);
}

/**
 * Identify keyword gaps from query analysis
 */
function identifyKeywordGaps(
  queryGaps: QueryGap[],
  competitorPages: Map<string, CrawledPage[]>
): KeywordGap[] {
  return queryGaps.slice(0, 10).map(gap => ({
    keyword: gap.query,
    competitorRanking: [{
      domain: gap.winningDomain,
      position: 1,
    }],
    yourPosition: gap.yourPosition === 'absent' ? null : 
                  gap.yourPosition === 'mentioned' ? 5 : 3,
    searchVolumeTier: 'unknown' as const,
    difficulty: determineKeywordDifficulty(gap),
    opportunity: gap.suggestedAction,
  }));
}

/**
 * Identify feature gaps
 */
function identifyFeatureGaps(
  yourPages: CrawledPage[],
  competitorPages: Map<string, CrawledPage[]>
): FeatureGap[] {
  const gaps: FeatureGap[] = [];

  // Check for FAQ presence
  const yourHasFAQ = yourPages.some(p => 
    p.schemas.some(s => s.type === 'FAQPage') ||
    p.headings.h2.some(h => h.toLowerCase().includes('faq') || h.includes('?'))
  );

  const competitorsWithFAQ: string[] = [];
  for (const [domain, pages] of competitorPages) {
    if (pages.some(p => 
      p.schemas.some(s => s.type === 'FAQPage') ||
      p.headings.h2.some(h => h.toLowerCase().includes('faq'))
    )) {
      competitorsWithFAQ.push(domain);
    }
  }

  if (!yourHasFAQ && competitorsWithFAQ.length > 0) {
    gaps.push({
      feature: 'FAQ Section',
      description: 'Dedicated FAQ content with FAQPage schema',
      competitorsHaving: competitorsWithFAQ,
      yourStatus: 'missing',
      implementationEffort: 'low',
      expectedImpact: 'FAQ schema enables rich results and AI answer features',
    });
  }

  // Check for comparison content
  const yourHasComparison = yourPages.some(p => 
    p.url.toLowerCase().includes('vs') ||
    p.url.toLowerCase().includes('compare') ||
    p.headings.h1.some(h => h.toLowerCase().includes('vs'))
  );

  const competitorsWithComparison: string[] = [];
  for (const [domain, pages] of competitorPages) {
    if (pages.some(p => 
      p.url.toLowerCase().includes('vs') ||
      p.url.toLowerCase().includes('compare')
    )) {
      competitorsWithComparison.push(domain);
    }
  }

  if (!yourHasComparison && competitorsWithComparison.length > 0) {
    gaps.push({
      feature: 'Comparison Content',
      description: 'Product/service comparison pages',
      competitorsHaving: competitorsWithComparison,
      yourStatus: 'missing',
      implementationEffort: 'medium',
      expectedImpact: 'Comparison queries are high-intent and AI-friendly',
    });
  }

  // Check for How-To content
  const yourHasHowTo = yourPages.some(p =>
    p.schemas.some(s => s.type === 'HowTo') ||
    p.url.toLowerCase().includes('how-to') ||
    p.headings.h1.some(h => h.toLowerCase().startsWith('how to'))
  );

  const competitorsWithHowTo: string[] = [];
  for (const [domain, pages] of competitorPages) {
    if (pages.some(p => p.schemas.some(s => s.type === 'HowTo'))) {
      competitorsWithHowTo.push(domain);
    }
  }

  if (!yourHasHowTo && competitorsWithHowTo.length > 0) {
    gaps.push({
      feature: 'How-To Guides',
      description: 'Step-by-step tutorial content with HowTo schema',
      competitorsHaving: competitorsWithHowTo,
      yourStatus: 'missing',
      implementationEffort: 'medium',
      expectedImpact: 'HowTo content is highly valued by AI systems',
    });
  }

  return gaps;
}

/**
 * Identify schema gaps
 */
function identifySchemaGaps(
  yourPages: CrawledPage[],
  competitorPages: Map<string, CrawledPage[]>
): SchemaGap[] {
  const gaps: SchemaGap[] = [];

  // Count your schema usage
  const yourSchemaCount = new Map<string, number>();
  for (const page of yourPages) {
    for (const schema of page.schemas) {
      yourSchemaCount.set(schema.type, (yourSchemaCount.get(schema.type) || 0) + 1);
    }
  }

  // Count competitor schema usage
  const competitorSchemaCount = new Map<string, Map<string, number>>();
  for (const [domain, pages] of competitorPages) {
    const domainCount = new Map<string, number>();
    for (const page of pages) {
      for (const schema of page.schemas) {
        domainCount.set(schema.type, (domainCount.get(schema.type) || 0) + 1);
      }
    }
    competitorSchemaCount.set(domain, domainCount);
  }

  // Identify important schemas competitors use that you don't
  const importantSchemas = ['FAQPage', 'HowTo', 'Product', 'Article', 'BlogPosting', 'Organization', 'BreadcrumbList'];

  for (const schemaType of importantSchemas) {
    const yourUsage = yourSchemaCount.get(schemaType) || 0;
    const competitorUsage: { domain: string; pageCount: number }[] = [];

    for (const [domain, counts] of competitorSchemaCount) {
      const count = counts.get(schemaType) || 0;
      if (count > 0) {
        competitorUsage.push({ domain, pageCount: count });
      }
    }

    if (yourUsage === 0 && competitorUsage.length > 0) {
      const importance = ['FAQPage', 'HowTo', 'Product'].includes(schemaType) 
        ? 'critical' as const
        : ['Article', 'BlogPosting', 'Organization'].includes(schemaType)
          ? 'recommended' as const
          : 'optional' as const;

      gaps.push({
        schemaType,
        competitorUsage,
        yourUsage,
        importance,
        recommendation: `Implement ${schemaType} schema on relevant pages`,
      });
    }
  }

  return gaps.sort((a, b) => {
    const importanceOrder = { critical: 0, recommended: 1, optional: 2 };
    return importanceOrder[a.importance] - importanceOrder[b.importance];
  });
}

// ===================
// Summary & Recommendations
// ===================

/**
 * Calculate gap summary
 */
function calculateGapSummary(
  contentGaps: ContentGap[],
  keywordGaps: KeywordGap[],
  featureGaps: FeatureGap[],
  schemaGaps: SchemaGap[]
): GapSummary {
  const totalGaps = contentGaps.length + keywordGaps.length + featureGaps.length + schemaGaps.length;

  const highPriorityGaps = 
    contentGaps.filter(g => g.priority === 'high').length +
    featureGaps.filter(g => g.implementationEffort === 'low').length +
    schemaGaps.filter(g => g.importance === 'critical').length;

  const quickWins = 
    featureGaps.filter(g => g.implementationEffort === 'low').length +
    schemaGaps.filter(g => g.importance === 'critical').length;

  // Calculate coverage scores
  const contentCoverage = Math.max(0, 100 - (contentGaps.length * 10));
  const schemaCoverage = Math.max(0, 100 - (schemaGaps.length * 15));
  const competitiveReadiness = Math.round((contentCoverage + schemaCoverage) / 2 - (highPriorityGaps * 5));

  return {
    totalGaps,
    highPriorityGaps,
    quickWins,
    contentCoverage: Math.max(0, contentCoverage),
    schemaCoverage: Math.max(0, schemaCoverage),
    competitiveReadiness: Math.max(0, Math.min(100, competitiveReadiness)),
  };
}

/**
 * Generate prioritized recommendations
 */
function generateGapRecommendations(
  contentGaps: ContentGap[],
  keywordGaps: KeywordGap[],
  featureGaps: FeatureGap[],
  schemaGaps: SchemaGap[]
): GapRecommendation[] {
  const recommendations: GapRecommendation[] = [];
  let priority = 1;

  // Critical schema gaps first
  for (const gap of schemaGaps.filter(g => g.importance === 'critical')) {
    recommendations.push({
      priority: priority++,
      title: `Add ${gap.schemaType} Schema`,
      description: gap.recommendation,
      relatedGaps: [gap.schemaType],
      estimatedImpact: 'high',
      effort: 'low',
      timeframe: 'immediate',
    });
  }

  // Easy feature wins
  for (const gap of featureGaps.filter(g => g.implementationEffort === 'low')) {
    recommendations.push({
      priority: priority++,
      title: `Add ${gap.feature}`,
      description: gap.expectedImpact,
      relatedGaps: [gap.feature],
      estimatedImpact: 'medium',
      effort: 'low',
      timeframe: 'short-term',
    });
  }

  // High priority content gaps
  for (const gap of contentGaps.filter(g => g.priority === 'high').slice(0, 3)) {
    recommendations.push({
      priority: priority++,
      title: gap.suggestedAction,
      description: gap.description,
      relatedGaps: [gap.type],
      estimatedImpact: 'high',
      effort: 'medium',
      timeframe: 'short-term',
    });
  }

  // Keyword opportunities
  for (const gap of keywordGaps.filter(g => g.difficulty !== 'hard').slice(0, 3)) {
    recommendations.push({
      priority: priority++,
      title: `Target: "${gap.keyword}"`,
      description: gap.opportunity,
      relatedGaps: ['keyword'],
      estimatedImpact: 'medium',
      effort: 'medium',
      timeframe: 'short-term',
    });
  }

  return recommendations.slice(0, 10);
}

// ===================
// Helper Functions
// ===================

function findSimilarPage(target: CrawledPage, candidates: CrawledPage[]): CrawledPage | null {
  // Simple similarity based on template type
  const targetTemplate = detectTemplate(target);
  return candidates.find(c => detectTemplate(c).type === targetTemplate.type) || null;
}

function deduplicateGaps(gaps: ContentGap[]): ContentGap[] {
  const seen = new Set<string>();
  return gaps.filter(gap => {
    const key = `${gap.type}-${gap.description.slice(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function determineKeywordDifficulty(gap: QueryGap): 'easy' | 'medium' | 'hard' {
  // If winning domain is authoritative, it's harder
  const authoritativeDomains = ['wikipedia', 'google', 'amazon', 'microsoft', 'github'];
  if (authoritativeDomains.some(d => gap.winningDomain.includes(d))) {
    return 'hard';
  }

  // If you're mentioned but not cited, it's medium
  if (gap.yourPosition === 'mentioned') {
    return 'medium';
  }

  return 'easy';
}

