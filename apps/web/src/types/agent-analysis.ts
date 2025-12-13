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
