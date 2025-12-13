// ===================
// Configuration Types
// ===================

export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  pageTimeout: number; // milliseconds
  crawlDelay: number; // milliseconds (adaptive from robots.txt)
  maxJobDuration: number; // milliseconds
  viewport: { width: number; height: number };
  userAgent: string;
  followCanonical: boolean;
  respectRobotsTxt: boolean;
  skipExactDuplicates: boolean;
  urlExclusions: string[];
  maxFileSize: number; // bytes
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxPages: 50,
  maxDepth: 3,
  pageTimeout: 30000,
  crawlDelay: 1000,
  maxJobDuration: 15 * 60 * 1000, // 15 minutes
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  followCanonical: true,
  respectRobotsTxt: true,
  skipExactDuplicates: true,
  urlExclusions: ['/admin', '/login', '/logout', '/cart', '/checkout', '/search', '/api/'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

// ===================
// Job Types
// ===================

export type JobStatus = 'pending' | 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed' | 'blocked';

export interface CreateJobRequest {
  targetUrl: string;
  userId?: string;
  siteId?: string;
  config?: Partial<CrawlConfig>;
  competitors?: string[];
  webhookUrl?: string;
  authConfig?: {
    type: 'basic' | 'cookie';
    credentials: Record<string, string>;
  };
  llmModel?: string;
}

export interface Job {
  id: string;
  userId: string;
  tenantId?: string; // Deprecated: use userId instead
  targetUrl: string;
  status: JobStatus;
  config: CrawlConfig;
  competitors: string[];
  webhookUrl?: string;
  authConfig?: {
    type: 'basic' | 'cookie';
    credentials: Record<string, string>;
  };
  llmModel: string;
  progress: {
    pagesCrawled: number;
    pagesTotal: number;
    currentPhase: string;
  };
  metrics: {
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    apiCallsCount: number;
    storageUsedBytes: number;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}

// ===================
// Crawl Result Types
// ===================

export interface CrawledPage {
  url: string;
  canonicalUrl?: string;
  statusCode: number;
  contentType: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount: number;
  language?: string;
  lastModified?: string;
  schemas: SchemaOrgData[];
  links: {
    internal: string[];
    external: string[];
  };
  images: ImageData[];
  headings: HeadingStructure;
  robotsMeta: {
    noindex: boolean;
    nofollow: boolean;
  };
  hreflangAlternates: HreflangLink[];
  loadTimeMs: number;
  htmlSnapshot?: string; // S3 key
  crawledAt: string;
  warnings: string[];
}

export interface SchemaOrgData {
  type: string;
  properties: Record<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

export interface ImageData {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  hasAlt: boolean;
}

export interface HeadingStructure {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
}

export interface HreflangLink {
  lang: string;
  url: string;
}

// ===================
// Analysis Types
// ===================

export interface LLMEOAnalysis {
  score: number; // 0-100
  schemaAnalysis: {
    score: number;
    schemasFound: string[];
    missingRecommended: string[];
    invalidSchemas: string[];
  };
  semanticClarity: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
  crawlAccessibility: {
    score: number;
    blockedPages: string[];
    slowPages: string[];
    issues: string[];
  };
  contentDepth: {
    score: number;
    thinContentPages: string[];
    comprehensivePages: string[];
  };
  freshness: {
    score: number;
    stalePages: string[];
    recentPages: string[];
  };
}

export interface SEOAnalysis {
  score: number; // 0-100
  indexability: {
    score: number;
    noindexPages: string[];
    blockedByRobots: string[];
    issues: string[];
  };
  metadata: {
    score: number;
    missingTitles: string[];
    missingDescriptions: string[];
    duplicateTitles: string[];
    duplicateDescriptions: string[];
  };
  structure: {
    score: number;
    missingH1: string[];
    multipleH1: string[];
    headingHierarchyIssues: string[];
  };
  performance: {
    score: number;
    slowPages: string[];
    averageLoadTime: number;
  };
  images: {
    score: number;
    missingAlt: string[];
    totalImages: number;
    imagesWithAlt: number;
  };
}

// ===================
// Report Types
// ===================

export interface Report {
  meta: {
    jobId: string;
    userId: string;
    tenantId?: string; // Deprecated: use userId instead
    domain: string;
    generatedAt: string;
    pagesAnalyzed: number;
    crawlDuration: number;
  };
  scores: {
    llmeoScore: number;
    seoScore: number;
    overallScore: number;
    confidence: number;
  };
  llmeoAnalysis: LLMEOAnalysis;
  seoAnalysis: SEOAnalysis;
  recommendations: Recommendation[];
  llmSummary: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    nextSteps: string[];
  };
  copyReadyPrompt: string;
  promptVersion: string;
  warnings: Warning[];
  competitorComparison?: CompetitorComparison[];
  competitiveGapAnalysis?: CompetitiveGapAnalysis;
  artifacts: {
    rawSnapshots: string[];
    extractedData: string;
    fullReport: string;
  };
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'llmeo' | 'seo' | 'content' | 'technical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  affectedPages: string[];
  codeSnippet?: string;
}

export interface Warning {
  code: string;
  message: string;
  affectedPages: string[];
  severity: 'error' | 'warning' | 'info';
}

export interface CompetitorComparison {
  domain: string;
  llmeoScore: number;
  seoScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  engagementScore?: number;
}

export interface CompetitiveGapAnalysis {
  ahead: string[];
  behind: string[];
  opportunities: string[];
  priorityActions: string[];
}

// ===================
// API Response Types
// ===================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

// ===================
// User Types (from auth_user table)
// ===================

/**
 * User from the shared PostgreSQL database (auth_user table)
 * This replaces the legacy Tenant type in the unified database model.
 */
export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  role: string;
}

// ===================
// AEO (Answer Engine Optimization) Types
// ===================

/**
 * Page analysis result from discovery phase
 */
export interface PageAnalysis {
  topic: string;
  intent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  entities: string[];
  contentType: 'article' | 'product' | 'landing' | 'documentation' | 'blog' | 'other';
  summary: string;
  keyPoints: string[];
  
  // Business understanding for competitive analysis
  businessCategory: BusinessCategory;
  businessModel: string;
  competitorProfile: string;
  companyName: string;
}

/**
 * Business category classification for accurate competitor discovery
 */
export type BusinessCategory = 
  | 'saas'              // Software as a Service
  | 'ecommerce'         // Online retail / marketplace
  | 'education'         // Bootcamps, courses, training programs
  | 'agency'            // Service-based business (consulting, marketing, dev agency)
  | 'marketplace'       // Two-sided platforms
  | 'media'             // Publishers, news, content platforms
  | 'fintech'           // Financial services / technology
  | 'healthcare'        // Health services / technology
  | 'b2b-services'      // Business services
  | 'consumer-app'      // Consumer mobile/web applications
  | 'developer-tools'   // Tools for developers
  | 'ai-ml'             // AI/ML products and services
  | 'other';

/**
 * Generated query that the page should answer
 */
export interface TargetQuery {
  query: string;
  type: 'how-to' | 'what-is' | 'comparison' | 'best' | 'why' | 'other';
  relevanceScore: number; // 0-100
}

/**
 * Tavily search result for a single query
 */
export interface TavilySearchResult {
  query: string;
  results: TavilyResult[];
  searchedAt: string;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  domain: string;
}

/**
 * Citation analysis for a query
 */
export interface QueryCitation {
  query: string;
  yourPosition: 'cited' | 'mentioned' | 'absent';
  yourRank?: number; // Position in results if found
  topResults: {
    domain: string;
    url: string;
    rank: number;
  }[];
  winningDomain?: string;
  winningReason?: string;
}

/**
 * Competitor visibility data
 */
export interface CompetitorVisibility {
  domain: string;
  citationCount: number;
  citationRate: number; // Percentage of queries where cited
  averageRank: number;
  topQueries: string[];
  strengths: string[];
}

/**
 * Gap analysis for queries you should be winning
 */
export interface QueryGap {
  query: string;
  yourPosition: 'cited' | 'mentioned' | 'absent';
  winningDomain: string;
  winningUrl: string;
  winningReason: string;
  suggestedAction: string;
}

/**
 * Complete AEO Analysis result
 */
export interface AEOAnalysis {
  // Core metrics
  visibilityScore: number; // 0-100 - PRIMARY METRIC
  queriesAnalyzed: number;
  citationCount: number;
  citationRate: number; // Percentage of queries where your domain appears

  // Discovery results
  pageAnalysis: PageAnalysis;
  targetQueries: TargetQuery[];

  // Research results
  searchResults: TavilySearchResult[];

  // Analysis results
  citations: QueryCitation[];
  competitors: CompetitorVisibility[];
  gaps: QueryGap[];

  // Summary
  topPerformingQueries: string[];
  missedOpportunities: string[];
  keyFindings: string[];

  // Community engagement opportunities
  communityEngagement?: CommunityEngagementResult;
}

/**
 * AEO-focused recommendation
 */
export interface AEORecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'visibility' | 'content' | 'structure' | 'authority';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  targetQueries: string[];
  competitorExample?: {
    domain: string;
    url: string;
    whatTheyDoBetter: string;
  };
}

/**
 * Cursor-ready prompt for content optimization
 */
export interface CursorPrompt {
  prompt: string;
  targetFile?: string;
  sections: {
    name: string;
    action: 'add' | 'modify' | 'remove';
    content: string;
  }[];
  version: string;
  generatedAt: string;
}

/**
 * Extended Report with AEO analysis
 */
export interface AEOReport extends Omit<Report, 'scores'> {
  scores: {
    aeoVisibilityScore: number; // PRIMARY
    llmeoScore: number; // Secondary
    seoScore: number; // Secondary
    overallScore: number; // Weighted combination
    confidence: number;
  };
  aeoAnalysis: AEOAnalysis;
  aeoRecommendations: AEORecommendation[];
  cursorPrompt: CursorPrompt;
}

// ===================
// Historical Data Types
// ===================

/**
 * Historical crawl summary for trend tracking
 */
export interface CrawlHistory {
  jobId: string;
  userId: string;
  domain: string;
  crawledAt: string;
  pagesCount: number;
  scores: {
    aeoVisibilityScore: number;
    llmeoScore: number;
    seoScore: number;
    overallScore: number;
  };
  summary: {
    citationRate: number;
    queriesAnalyzed: number;
    competitorCount: number;
  };
}

/**
 * Diff summary stored in DynamoDB
 */
export interface DiffSummary {
  userId: string;
  domain: string;
  currentJobId: string;
  previousJobId: string;
  createdAt: string;
  summary: {
    pagesAdded: number;
    pagesRemoved: number;
    pagesModified: number;
    scoreChange: number;
  };
  diffReportS3Key: string;
}

// ===================
// Orchestrator & Agent Types
// ===================

/**
 * Execution plan generated by orchestrator agent
 */
export interface ExecutionPlan {
  phases: ExecutionPhase[];
  estimatedDuration: number; // seconds
  reasoning: string;
}

export interface ExecutionPhase {
  name: string;
  agents: string[]; // Agent IDs
  runInParallel: boolean;
  dependsOn?: string[]; // Phase names this depends on
}

/**
 * Generic agent result wrapper
 */
export interface AgentResult<T = unknown> {
  agentId: string;
  status: 'completed' | 'failed' | 'partial';
  result?: T;
  error?: string;
  duration?: number; // milliseconds
  timestamp: string;
}

/**
 * Google AI Overview search result
 */
export interface GoogleAIOResult {
  query: string;
  citations: Array<{
    domain: string;
    url: string;
    title: string;
    snippet: string;
    rank: number;
  }>;
  answer?: string;
  searchedAt: string;
}

/**
 * Perplexity search result
 */
export interface PerplexityResult {
  query: string;
  citations: Array<{
    domain: string;
    url: string;
    title: string;
    snippet: string;
    rank: number;
  }>;
  answer?: string;
  searchedAt: string;
}

/**
 * Community signal from platforms (legacy format for brand mentions)
 */
export interface CommunitySignal {
  platform: 'reddit' | 'hackernews' | 'github' | 'twitter';
  query: string;
  mentions: Array<{
    domain: string;
    url: string;
    title: string;
    score?: number; // Upvotes, stars, etc.
    engagement?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    timestamp: string;
  }>;
  searchedAt: string;
}

/**
 * Engagement opportunity found on community platforms
 * These are discussions where the brand could add value by participating
 */
export interface EngagementOpportunity {
  platform: 'reddit' | 'twitter' | 'hackernews' | 'other';
  url: string;
  title: string;
  snippet: string;
  query: string; // The query that found this
  relevanceScore: number; // 0-100
  opportunityType: 'question' | 'recommendation-request' | 'comparison' | 'discussion' | 'complaint';
  foundAt: string;
  whyGoodOpportunity?: string; // LLM-generated reason why this is a good opportunity
}

/**
 * Result from community engagement search
 */
export interface CommunityEngagementResult {
  totalOpportunities: number;
  platforms: {
    reddit: EngagementOpportunity[];
    twitter: EngagementOpportunity[];
    hackernews: EngagementOpportunity[];
    other: EngagementOpportunity[];
  };
  topOpportunities: EngagementOpportunity[];
  queryBreakdown: Array<{
    query: string;
    opportunitiesFound: number;
  }>;
  searchedAt: string;
}

/**
 * Analysis summary (stored in PostgreSQL analyses table)
 */
export interface AnalysisSummary {
  jobId: string;
  userId: string;
  domain: string;
  scores: {
    aeoVisibilityScore: number;
    llmeoScore: number;
    seoScore: number;
    overallScore: number;
    geoScore?: number; // NEW: Generative Engine Optimization score
  };
  keyMetrics: {
    citationRate: number;
    queriesAnalyzed: number;
    citationCount: number;
    topCompetitors: string[];
    llmMentionRate?: number; // NEW: % of LLM probes where brand appeared
  };
  summary: {
    topFindings: string[];
    topRecommendations: string[];
    grade: string;
  };
  reportS3Key: string; // Reference to full report in S3
  generatedAt: string;
}

// ===================
// GEO (Generative Engine Optimization) Types
// ===================

/**
 * Prompt category for LLM brand probing
 */
export type GeoPromptCategory =
  | 'direct'           // Questions directly about the brand
  | 'category'         // "Best X tools" type questions
  | 'problem'          // Questions about problems the brand solves
  | 'use_case'         // "How do I accomplish X?" questions
  | 'comparison'       // Brand vs competitor comparisons
  | 'industry'         // Industry trends and leaders
  | 'recommendation';  // "What should I use for X?" questions

/**
 * Generated probe prompt
 */
export interface GeoProbePrompt {
  prompt: string;
  category: GeoPromptCategory;
  targetBrand: string;
  relatedCompetitors: string[];
}

/**
 * Result from probing a single LLM with a prompt
 */
export interface GeoProbeResult {
  model: string;
  prompt: string;
  promptCategory: GeoPromptCategory;
  response: string;
  
  // Brand mention analysis
  brandMentioned: boolean;
  mentionType: 'primary' | 'listed' | 'compared' | 'indirect' | 'absent';
  mentionPosition?: number;
  mentionContext?: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_mentioned';
  
  // Competitor analysis
  competitorsMentioned: {
    name: string;
    mentioned: boolean;
    mentionType?: 'primary' | 'listed' | 'compared' | 'indirect';
    position?: number;
  }[];
  
  probedAt: string;
  responseTokens?: number;
}

/**
 * Aggregated results from LLM brand probing
 */
export interface GeoBrandProbeResult {
  // Core metrics
  overallMentionRate: number;
  primaryMentionRate: number;
  averageMentionPosition: number;
  
  // Breakdown by model
  modelBreakdown: Record<string, {
    mentionRate: number;
    primaryRate: number;
    probeCount: number;
  }>;
  
  // Breakdown by prompt category
  categoryBreakdown: Record<GeoPromptCategory, {
    mentionRate: number;
    primaryRate: number;
    probeCount: number;
  }>;
  
  // Competitor comparison
  competitorComparison: {
    competitor: string;
    theirMentionRate: number;
    yourMentionRate: number;
    headToHeadWins: number;
    headToHeadLosses: number;
  }[];
  
  // Sentiment
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  
  // GEO Score
  geoScore: number;
  geoGrade: string;
  
  // Insights
  strongCategories: string[];
  weakCategories: string[];
  keyFindings: string[];
  
  // Metadata
  totalProbes: number;
  modelsUsed: string[];
  probedAt: string;
}

