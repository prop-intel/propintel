/**
 * TypeScript types for PropIntel Backend API
 * Based on the Backend Integration Guide
 */

// Job Status Types
export type JobStatus =
  | "pending"
  | "queued"
  | "crawling"
  | "analyzing"
  | "completed"
  | "failed"
  | "blocked";

// Job Interface
export interface Job {
  id: string;
  status: JobStatus;
  targetUrl: string;
  progress: {
    pagesCrawled: number;
    pagesTotal: number;
    currentPhase: string;
  };
  config?: {
    maxPages?: number;
    maxDepth?: number;
    [key: string]: unknown;
  };
  competitors?: string[];
  webhookUrl?: string;
  llmModel?: string;
  metrics?: {
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    apiCallsCount?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Scores Interface
export interface Scores {
  aeoVisibilityScore: number;
  llmeoScore: number;
  seoScore: number;
  overallScore: number;
  confidence: number;
}

// Recommendation Interface
export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  category: "visibility" | "content" | "structure" | "authority";
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  targetQueries?: string[];
  competitorExample?: {
    domain: string;
    url: string;
    whatTheyDoBetter: string;
  };
}

// AEO Analysis Interfaces
export interface PageAnalysis {
  topic: string;
  intent: "informational" | "navigational" | "transactional" | "commercial";
  entities: string[];
  summary: string;
}

export interface TargetQuery {
  query: string;
  type: string;
  relevanceScore: number;
}

export interface Citation {
  query: string;
  yourPosition: "cited" | "absent";
  yourRank?: number;
  topResults: Array<{
    domain: string;
    url: string;
    rank: number;
  }>;
}

export interface CompetitorAnalysis {
  domain: string;
  citationCount: number;
  citationRate: number;
  averageRank: number;
  strengths: string[];
}

export interface Gap {
  query: string;
  yourPosition: "absent";
  winningDomain: string;
  winningUrl: string;
  suggestedAction: string;
}

export interface AEOAnalysis {
  visibilityScore: number;
  queriesAnalyzed: number;
  citationCount: number;
  citationRate: number;
  pageAnalysis: PageAnalysis;
  targetQueries: TargetQuery[];
  citations: Citation[];
  competitors: CompetitorAnalysis[];
  gaps: Gap[];
  topPerformingQueries: string[];
  missedOpportunities: string[];
  keyFindings: string[];
}

// LLMEO Analysis Interfaces
export interface SchemaAnalysis {
  score: number;
  schemasFound: string[];
}

export interface SemanticClarity {
  score: number;
  issues: string[];
}

export interface ContentDepth {
  score: number;
  thinContentPages: string[];
}

export interface LLMEOAnalysis {
  score: number;
  schemaAnalysis: SchemaAnalysis;
  semanticClarity: SemanticClarity;
  contentDepth: ContentDepth;
}

// SEO Analysis Interfaces
export interface SEOAnalysis {
  score: number;
  indexability: { score: number };
  metadata: { score: number };
  structure: { score: number };
  performance: {
    score: number;
    averageLoadTime?: number;
  };
  images: {
    score: number;
    missingAlt?: string[];
  };
}

// Cursor Prompt Interface
export interface CursorPrompt {
  prompt: string;
  sections: Array<{
    name: string;
    action: "add" | "modify" | "remove";
    content: string;
  }>;
  version: string;
}

// LLM Summary Interface
export interface LLMSummary {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  nextSteps: string[];
}

// Report Interface
export interface Report {
  meta: {
    jobId: string;
    tenantId: string;
    domain: string;
    generatedAt: string;
    pagesAnalyzed: number;
  };
  scores: Scores;
  aeoAnalysis: AEOAnalysis;
  aeoRecommendations: Recommendation[];
  cursorPrompt: CursorPrompt;
  llmeoAnalysis: LLMEOAnalysis;
  seoAnalysis: SEOAnalysis;
  recommendations: Recommendation[];
  llmSummary: LLMSummary;
}

// Dashboard Interfaces
export interface DashboardOverview {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageScore: number;
  scoreChange: number;
}

export interface RecentJob {
  jobId: string;
  domain: string;
  status: JobStatus;
  aeoScore: number;
  completedAt: string;
}

export interface TopDomain {
  domain: string;
  jobCount: number;
  latestScore: number;
  trend: "up" | "down" | "stable";
}

export interface Alert {
  type: "score_drop" | "new_competitor" | "gap_identified" | "error";
  severity: "critical" | "warning" | "info";
  message: string;
  domain?: string;
  createdAt: string;
}

export interface DashboardSummary {
  overview: DashboardOverview;
  recentJobs: RecentJob[];
  topDomains: TopDomain[];
  alerts: Alert[];
}

export interface TrendDataPoint {
  date: string;
  aeoScore: number;
  llmeoScore: number;
  seoScore: number;
  citationRate: number;
}

export interface ScoreTrends {
  domain?: string;
  period: string;
  trends: TrendDataPoint[];
}

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Job Creation Request
export interface CreateJobRequest {
  targetUrl: string;
  config?: {
    maxPages?: number;
    maxDepth?: number;
    [key: string]: unknown;
  };
  competitors?: string[];
  webhookUrl?: string;
  llmModel?: string;
}
