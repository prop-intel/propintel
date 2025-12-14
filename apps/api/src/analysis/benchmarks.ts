/**
 * Industry Benchmarks
 *
 * Provides industry-specific benchmarks for comparison
 * and goal-setting in AEO/SEO optimization.
 */

// ===================
// Types
// ===================

export type IndustryType =
  | 'saas'
  | 'ecommerce'
  | 'media'
  | 'finance'
  | 'healthcare'
  | 'education'
  | 'travel'
  | 'realestate'
  | 'legal'
  | 'technology'
  | 'other';

export interface IndustryBenchmark {
  industry: IndustryType;
  metrics: {
    aeoVisibilityScore: BenchmarkRange;
    citationRate: BenchmarkRange;
    llmeoScore: BenchmarkRange;
    seoScore: BenchmarkRange;
    avgWordCount: BenchmarkRange;
    schemaAdoption: BenchmarkRange;
    pageLoadTime: BenchmarkRange;
  };
  topPerformers: {
    characteristic: string;
    percentage: number;
  }[];
  commonGaps: string[];
}

export interface BenchmarkRange {
  low: number;
  median: number;
  high: number;
  topPercentile: number; // 90th percentile
}

export interface BenchmarkComparison {
  metric: string;
  yourValue: number;
  benchmark: BenchmarkRange;
  percentile: number;
  status: 'below' | 'average' | 'above' | 'top';
  recommendation?: string;
}

// ===================
// Benchmark Data
// ===================

const INDUSTRY_BENCHMARKS: Record<IndustryType, IndustryBenchmark> = {
  saas: {
    industry: 'saas',
    metrics: {
      aeoVisibilityScore: { low: 35, median: 55, high: 75, topPercentile: 85 },
      citationRate: { low: 15, median: 35, high: 55, topPercentile: 70 },
      llmeoScore: { low: 40, median: 60, high: 78, topPercentile: 88 },
      seoScore: { low: 50, median: 68, high: 82, topPercentile: 90 },
      avgWordCount: { low: 500, median: 1200, high: 2000, topPercentile: 2500 },
      schemaAdoption: { low: 20, median: 45, high: 70, topPercentile: 85 },
      pageLoadTime: { low: 4000, median: 2500, high: 1500, topPercentile: 1000 },
    },
    topPerformers: [
      { characteristic: 'Have comprehensive documentation', percentage: 85 },
      { characteristic: 'Use FAQPage schema', percentage: 70 },
      { characteristic: 'Maintain active blog', percentage: 90 },
      { characteristic: 'Include comparison pages', percentage: 65 },
    ],
    commonGaps: [
      'Missing HowTo schema on tutorial content',
      'Pricing pages lack structured data',
      'Feature pages too shallow',
      'Missing integration documentation',
    ],
  },

  ecommerce: {
    industry: 'ecommerce',
    metrics: {
      aeoVisibilityScore: { low: 30, median: 48, high: 68, topPercentile: 80 },
      citationRate: { low: 10, median: 25, high: 45, topPercentile: 60 },
      llmeoScore: { low: 35, median: 55, high: 72, topPercentile: 85 },
      seoScore: { low: 55, median: 72, high: 85, topPercentile: 92 },
      avgWordCount: { low: 200, median: 500, high: 1000, topPercentile: 1500 },
      schemaAdoption: { low: 40, median: 65, high: 85, topPercentile: 95 },
      pageLoadTime: { low: 3500, median: 2200, high: 1300, topPercentile: 900 },
    },
    topPerformers: [
      { characteristic: 'Complete Product schema', percentage: 95 },
      { characteristic: 'Include customer reviews', percentage: 80 },
      { characteristic: 'Have buying guides', percentage: 60 },
      { characteristic: 'Comparison content', percentage: 55 },
    ],
    commonGaps: [
      'Category pages lack descriptions',
      'Missing AggregateRating schema',
      'Product descriptions too short',
      'No FAQ content',
    ],
  },

  media: {
    industry: 'media',
    metrics: {
      aeoVisibilityScore: { low: 40, median: 60, high: 80, topPercentile: 90 },
      citationRate: { low: 25, median: 45, high: 65, topPercentile: 80 },
      llmeoScore: { low: 45, median: 65, high: 82, topPercentile: 92 },
      seoScore: { low: 55, median: 72, high: 85, topPercentile: 93 },
      avgWordCount: { low: 600, median: 1000, high: 1800, topPercentile: 2500 },
      schemaAdoption: { low: 50, median: 70, high: 88, topPercentile: 95 },
      pageLoadTime: { low: 3000, median: 2000, high: 1200, topPercentile: 800 },
    },
    topPerformers: [
      { characteristic: 'Use NewsArticle schema', percentage: 90 },
      { characteristic: 'Include author pages', percentage: 85 },
      { characteristic: 'Have topic hubs', percentage: 75 },
      { characteristic: 'Regular content updates', percentage: 95 },
    ],
    commonGaps: [
      'Missing author expertise signals',
      'Old content not updated',
      'Poor internal linking',
      'Missing FAQ sections',
    ],
  },

  finance: {
    industry: 'finance',
    metrics: {
      aeoVisibilityScore: { low: 30, median: 50, high: 70, topPercentile: 82 },
      citationRate: { low: 12, median: 30, high: 50, topPercentile: 65 },
      llmeoScore: { low: 38, median: 58, high: 75, topPercentile: 86 },
      seoScore: { low: 52, median: 70, high: 84, topPercentile: 91 },
      avgWordCount: { low: 800, median: 1500, high: 2500, topPercentile: 3500 },
      schemaAdoption: { low: 25, median: 50, high: 72, topPercentile: 85 },
      pageLoadTime: { low: 3500, median: 2300, high: 1400, topPercentile: 950 },
    },
    topPerformers: [
      { characteristic: 'Comprehensive guides', percentage: 80 },
      { characteristic: 'Expert author bios', percentage: 75 },
      { characteristic: 'Calculator tools', percentage: 60 },
      { characteristic: 'Regular updates', percentage: 85 },
    ],
    commonGaps: [
      'Missing YMYL trust signals',
      'Author expertise not highlighted',
      'Content too technical',
      'Missing comparison content',
    ],
  },

  healthcare: {
    industry: 'healthcare',
    metrics: {
      aeoVisibilityScore: { low: 25, median: 45, high: 65, topPercentile: 78 },
      citationRate: { low: 10, median: 28, high: 48, topPercentile: 62 },
      llmeoScore: { low: 35, median: 55, high: 72, topPercentile: 84 },
      seoScore: { low: 48, median: 66, high: 80, topPercentile: 88 },
      avgWordCount: { low: 1000, median: 1800, high: 3000, topPercentile: 4000 },
      schemaAdoption: { low: 30, median: 55, high: 75, topPercentile: 88 },
      pageLoadTime: { low: 3800, median: 2500, high: 1500, topPercentile: 1000 },
    },
    topPerformers: [
      { characteristic: 'Medical expert reviews', percentage: 70 },
      { characteristic: 'Clear source citations', percentage: 85 },
      { characteristic: 'Regular content audits', percentage: 60 },
      { characteristic: 'Comprehensive condition pages', percentage: 75 },
    ],
    commonGaps: [
      'Missing medical credentials',
      'No last-reviewed dates',
      'Sources not cited',
      'Missing MedicalCondition schema',
    ],
  },

  education: {
    industry: 'education',
    metrics: {
      aeoVisibilityScore: { low: 35, median: 55, high: 75, topPercentile: 85 },
      citationRate: { low: 18, median: 38, high: 58, topPercentile: 72 },
      llmeoScore: { low: 42, median: 62, high: 78, topPercentile: 88 },
      seoScore: { low: 50, median: 68, high: 82, topPercentile: 90 },
      avgWordCount: { low: 700, median: 1400, high: 2200, topPercentile: 3000 },
      schemaAdoption: { low: 35, median: 58, high: 78, topPercentile: 90 },
      pageLoadTime: { low: 3200, median: 2100, high: 1300, topPercentile: 850 },
    },
    topPerformers: [
      { characteristic: 'Course structured data', percentage: 75 },
      { characteristic: 'Clear learning paths', percentage: 65 },
      { characteristic: 'Video content', percentage: 70 },
      { characteristic: 'Quiz/assessment tools', percentage: 55 },
    ],
    commonGaps: [
      'Missing Course schema',
      'No prerequisite information',
      'Learning objectives unclear',
      'Missing instructor credentials',
    ],
  },

  travel: {
    industry: 'travel',
    metrics: {
      aeoVisibilityScore: { low: 32, median: 52, high: 72, topPercentile: 83 },
      citationRate: { low: 14, median: 32, high: 52, topPercentile: 68 },
      llmeoScore: { low: 40, median: 58, high: 75, topPercentile: 86 },
      seoScore: { low: 52, median: 70, high: 84, topPercentile: 91 },
      avgWordCount: { low: 600, median: 1200, high: 2000, topPercentile: 2800 },
      schemaAdoption: { low: 38, median: 60, high: 80, topPercentile: 92 },
      pageLoadTime: { low: 3600, median: 2400, high: 1400, topPercentile: 950 },
    },
    topPerformers: [
      { characteristic: 'Rich destination guides', percentage: 80 },
      { characteristic: 'TouristAttraction schema', percentage: 65 },
      { characteristic: 'Local tips content', percentage: 70 },
      { characteristic: 'Seasonal content updates', percentage: 60 },
    ],
    commonGaps: [
      'Missing location schema',
      'Outdated travel info',
      'No practical tips',
      'Missing booking schema',
    ],
  },

  realestate: {
    industry: 'realestate',
    metrics: {
      aeoVisibilityScore: { low: 28, median: 48, high: 68, topPercentile: 80 },
      citationRate: { low: 12, median: 28, high: 48, topPercentile: 62 },
      llmeoScore: { low: 35, median: 55, high: 72, topPercentile: 84 },
      seoScore: { low: 50, median: 68, high: 82, topPercentile: 90 },
      avgWordCount: { low: 400, median: 800, high: 1400, topPercentile: 2000 },
      schemaAdoption: { low: 30, median: 52, high: 72, topPercentile: 85 },
      pageLoadTime: { low: 4000, median: 2600, high: 1600, topPercentile: 1100 },
    },
    topPerformers: [
      { characteristic: 'RealEstateListing schema', percentage: 70 },
      { characteristic: 'Neighborhood guides', percentage: 60 },
      { characteristic: 'Market analysis content', percentage: 55 },
      { characteristic: 'Virtual tour integration', percentage: 45 },
    ],
    commonGaps: [
      'Missing property schema',
      'No area information',
      'Thin listing descriptions',
      'Missing price history',
    ],
  },

  legal: {
    industry: 'legal',
    metrics: {
      aeoVisibilityScore: { low: 25, median: 45, high: 65, topPercentile: 78 },
      citationRate: { low: 10, median: 26, high: 45, topPercentile: 60 },
      llmeoScore: { low: 32, median: 52, high: 70, topPercentile: 82 },
      seoScore: { low: 45, median: 64, high: 78, topPercentile: 87 },
      avgWordCount: { low: 800, median: 1600, high: 2800, topPercentile: 4000 },
      schemaAdoption: { low: 20, median: 42, high: 65, topPercentile: 80 },
      pageLoadTime: { low: 3500, median: 2300, high: 1400, topPercentile: 950 },
    },
    topPerformers: [
      { characteristic: 'Attorney profiles with credentials', percentage: 80 },
      { characteristic: 'Practice area pages', percentage: 85 },
      { characteristic: 'FAQ sections', percentage: 70 },
      { characteristic: 'Case results/testimonials', percentage: 55 },
    ],
    commonGaps: [
      'Missing attorney credentials',
      'No case examples',
      'Generic practice descriptions',
      'Missing LocalBusiness schema',
    ],
  },

  technology: {
    industry: 'technology',
    metrics: {
      aeoVisibilityScore: { low: 38, median: 58, high: 78, topPercentile: 88 },
      citationRate: { low: 20, median: 40, high: 60, topPercentile: 75 },
      llmeoScore: { low: 45, median: 65, high: 82, topPercentile: 92 },
      seoScore: { low: 55, median: 72, high: 85, topPercentile: 93 },
      avgWordCount: { low: 600, median: 1300, high: 2200, topPercentile: 3000 },
      schemaAdoption: { low: 45, median: 68, high: 85, topPercentile: 95 },
      pageLoadTime: { low: 2800, median: 1800, high: 1100, topPercentile: 750 },
    },
    topPerformers: [
      { characteristic: 'Comprehensive documentation', percentage: 90 },
      { characteristic: 'Tutorial content', percentage: 85 },
      { characteristic: 'GitHub integration', percentage: 70 },
      { characteristic: 'API reference pages', percentage: 75 },
    ],
    commonGaps: [
      'Missing code examples',
      'Outdated documentation',
      'No getting started guide',
      'Missing version information',
    ],
  },

  other: {
    industry: 'other',
    metrics: {
      aeoVisibilityScore: { low: 30, median: 50, high: 70, topPercentile: 82 },
      citationRate: { low: 15, median: 32, high: 52, topPercentile: 68 },
      llmeoScore: { low: 38, median: 58, high: 75, topPercentile: 86 },
      seoScore: { low: 50, median: 68, high: 82, topPercentile: 90 },
      avgWordCount: { low: 500, median: 1000, high: 1800, topPercentile: 2500 },
      schemaAdoption: { low: 30, median: 52, high: 72, topPercentile: 85 },
      pageLoadTime: { low: 3500, median: 2300, high: 1400, topPercentile: 950 },
    },
    topPerformers: [
      { characteristic: 'Clear value proposition', percentage: 75 },
      { characteristic: 'FAQ content', percentage: 60 },
      { characteristic: 'Regular updates', percentage: 65 },
      { characteristic: 'Contact information', percentage: 80 },
    ],
    commonGaps: [
      'Missing basic schema',
      'Thin content',
      'Poor structure',
      'No trust signals',
    ],
  },
};

// ===================
// Main Functions
// ===================

/**
 * Get benchmark data for an industry
 */
export function getIndustryBenchmark(industry: IndustryType): IndustryBenchmark {
  return INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.other;
}

/**
 * Compare metrics against industry benchmark
 */
export function compareToIndustryBenchmark(
  metrics: {
    aeoVisibilityScore: number;
    citationRate: number;
    llmeoScore: number;
    seoScore: number;
    avgWordCount: number;
    schemaAdoption: number;
    pageLoadTime: number;
  },
  industry: IndustryType
): BenchmarkComparison[] {
  const benchmark = getIndustryBenchmark(industry);
  const comparisons: BenchmarkComparison[] = [];

  // Helper to calculate percentile
  const calculatePercentile = (value: number, range: BenchmarkRange, inverted = false): number => {
    if (inverted) {
      // Lower is better (e.g., page load time)
      if (value <= range.topPercentile) return 95;
      if (value <= range.high) return 75;
      if (value <= range.median) return 50;
      if (value <= range.low) return 25;
      return 10;
    } else {
      if (value >= range.topPercentile) return 95;
      if (value >= range.high) return 75;
      if (value >= range.median) return 50;
      if (value >= range.low) return 25;
      return 10;
    }
  };

  // Helper to determine status
  const getStatus = (percentile: number): 'below' | 'average' | 'above' | 'top' => {
    if (percentile >= 90) return 'top';
    if (percentile >= 60) return 'above';
    if (percentile >= 40) return 'average';
    return 'below';
  };

  // Compare each metric
  const metricConfigs: Array<{
    key: keyof typeof metrics;
    name: string;
    inverted?: boolean;
    recommendation?: (status: string, value: number, range: BenchmarkRange) => string | undefined;
  }> = [
    {
      key: 'aeoVisibilityScore',
      name: 'AEO Visibility Score',
      recommendation: (status, value, range) =>
        status === 'below' ? `Target score of ${range.median}+ to reach industry average` : undefined,
    },
    {
      key: 'citationRate',
      name: 'Citation Rate',
      recommendation: (status, value, range) =>
        status === 'below' ? `Increase citation rate to ${range.median}%+ through better content` : undefined,
    },
    { key: 'llmeoScore', name: 'LLMEO Score' },
    { key: 'seoScore', name: 'SEO Score' },
    {
      key: 'avgWordCount',
      name: 'Average Word Count',
      recommendation: (status, value, range) =>
        status === 'below' ? `Expand content to ${range.median}+ words for ${industry} industry` : undefined,
    },
    {
      key: 'schemaAdoption',
      name: 'Schema Adoption',
      recommendation: (status, value, range) =>
        status === 'below' ? `Implement schema markup on ${range.median}%+ of pages` : undefined,
    },
    {
      key: 'pageLoadTime',
      name: 'Page Load Time',
      inverted: true,
      recommendation: (status, value, range) =>
        status === 'below' ? `Optimize to load under ${range.median}ms` : undefined,
    },
  ];

  for (const config of metricConfigs) {
    const value = metrics[config.key];
    const range = benchmark.metrics[config.key];
    const percentile = calculatePercentile(value, range, config.inverted);
    const status = getStatus(percentile);

    comparisons.push({
      metric: config.name,
      yourValue: value,
      benchmark: range,
      percentile,
      status,
      recommendation: config.recommendation?.(status, value, range),
    });
  }

  return comparisons;
}

/**
 * Detect industry from page content
 */
export function detectIndustry(
  domain: string,
  pages: Array<{ url: string; title?: string; schemas: Array<{ type: string }> }>
): IndustryType {
  const signals = new Map<IndustryType, number>();

  // Initialize
  const industries: IndustryType[] = [
    'saas', 'ecommerce', 'media', 'finance', 'healthcare',
    'education', 'travel', 'realestate', 'legal', 'technology', 'other'
  ];
  industries.forEach(i => signals.set(i, 0));

  // Domain-based signals
  const domainPatterns: Record<string, IndustryType[]> = {
    shop: ['ecommerce'],
    store: ['ecommerce'],
    buy: ['ecommerce'],
    news: ['media'],
    blog: ['media'],
    bank: ['finance'],
    invest: ['finance'],
    health: ['healthcare'],
    med: ['healthcare'],
    learn: ['education'],
    edu: ['education'],
    travel: ['travel'],
    hotel: ['travel'],
    realty: ['realestate'],
    homes: ['realestate'],
    law: ['legal'],
    attorney: ['legal'],
    tech: ['technology'],
    dev: ['technology'],
    app: ['saas', 'technology'],
  };

  for (const [pattern, industries] of Object.entries(domainPatterns)) {
    if (domain.includes(pattern)) {
      industries.forEach(i => signals.set(i, (signals.get(i) || 0) + 20));
    }
  }

  // Schema-based signals
  const schemaSignals: Record<string, IndustryType[]> = {
    Product: ['ecommerce'],
    Offer: ['ecommerce', 'saas'],
    NewsArticle: ['media'],
    Article: ['media'],
    FinancialProduct: ['finance'],
    MedicalCondition: ['healthcare'],
    Course: ['education'],
    TouristAttraction: ['travel'],
    RealEstateListing: ['realestate'],
    LegalService: ['legal'],
    SoftwareApplication: ['technology', 'saas'],
  };

  for (const page of pages) {
    for (const schema of page.schemas) {
      const matchingIndustries = schemaSignals[schema.type];
      if (matchingIndustries) {
        matchingIndustries.forEach(i => signals.set(i, (signals.get(i) || 0) + 15));
      }
    }
  }

  // Find highest scoring industry
  let bestIndustry: IndustryType = 'other';
  let bestScore = 0;

  for (const [industry, score] of signals) {
    if (score > bestScore) {
      bestScore = score;
      bestIndustry = industry;
    }
  }

  return bestIndustry;
}

