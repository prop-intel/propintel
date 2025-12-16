export interface AgentSummary {
  status?: string;
  summary?: string;
  keyFindings?: string[];
}

export interface SummaryScores {
  aeoVisibilityScore?: number;
  llmeoScore?: number;
  seoScore?: number;
  overallScore?: number;
}

export interface EngagementOpportunity {
  platform: "reddit" | "twitter" | "other";
  url: string;
  title: string;
  snippet: string;
  query: string;
  relevanceScore: number;
  opportunityType:
    | "question"
    | "recommendation-request"
    | "comparison"
    | "discussion"
    | "complaint";
  foundAt: string;
  whyGoodOpportunity?: string;
}

export interface CommunityEngagement {
  totalOpportunities: number;
  platforms: {
    reddit: EngagementOpportunity[];
    twitter: EngagementOpportunity[];
    other: EngagementOpportunity[];
  };
  topOpportunities: EngagementOpportunity[];
  queryBreakdown: Array<{
    query: string;
    opportunitiesFound: number;
  }>;
  searchedAt: string;
}

export interface AEOAnalysis {
  visibilityScore?: number;
  queriesAnalyzed?: number;
  citationCount?: number;
  citationRate?: number;
  pageAnalysis?: {
    topic?: string;
    intent?: string;
    entities?: string[];
    contentType?: string;
    summary?: string;
    keyPoints?: string[];
  };
  targetQueries?: Array<{
    query: string;
    type: string;
    relevanceScore: number;
  }>;
  citations?: Array<{
    query: string;
    yourPosition: "cited" | "mentioned" | "absent";
    yourRank?: number;
    topResults?: Array<{
      domain: string;
      url: string;
      rank: number;
    }>;
    winningDomain?: string;
    winningReason?: string;
  }>;
  competitors?: Array<{
    domain: string;
    citationCount: number;
    citationRate: number;
    averageRank: number;
    topQueries?: string[];
    strengths?: string[];
  }>;
  gaps?: Array<{
    query: string;
    yourPosition: string;
    winningDomain: string;
    winningUrl: string;
    winningReason?: string;
    suggestedAction?: string;
  }>;
  keyFindings?: string[];
  topPerformingQueries?: string[];
  missedOpportunities?: string[];
  // Community engagement opportunities
  communityEngagement?: CommunityEngagement;
}

export interface AEORecommendation {
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

export interface CursorPrompt {
  prompt: string;
  sections: Array<{
    name: string;
    action: "add" | "modify" | "remove";
    content: string;
  }>;
  version: string;
  generatedAt?: string;
}

export interface FullSummary {
  scores?: SummaryScores;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  nextSteps?: string[];
  recommendations?: Recommendation[];
  fullReport?: {
    aeoAnalysis?: AEOAnalysis;
    aeoRecommendations?: AEORecommendation[];
    cursorPrompt?: CursorPrompt;
    meta?: {
      domain?: string;
    };
    scores?: {
      confidence?: number;
    };
    [key: string]: unknown;
  };
}

export interface Recommendation {
  title?: string;
  priority?: "high" | "medium" | "low";
  description?: string;
}

export interface StatusUpdate {
  phase: string;
  status: string;
  timestamp: Date;
  summary?: unknown;
  agentSummaries?: Record<string, unknown>;
}

// Type guard to check if summary is a FullSummary object
export function isFullSummary(summary: unknown): summary is FullSummary {
  return typeof summary === "object" && summary !== null;
}
