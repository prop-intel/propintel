/**
 * Agent Registry
 *
 * Central registry of all available agents with metadata,
 * dependencies, and execution configuration.
 */

// ===================
// Types
// ===================

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  category: 'discovery' | 'research' | 'analysis' | 'output';
  inputs: string[]; // Required input agent IDs
  outputs: string; // Output type
  canRunInParallel: boolean;
  estimatedDuration: number; // seconds
  retryable: boolean;
  errorHandling: 'fail' | 'skip' | 'retry';
}

// ===================
// Agent Registry
// ===================

const AGENT_REGISTRY: Record<string, AgentMetadata> = {
  // Discovery Agents
  'page-analysis': {
    id: 'page-analysis',
    name: 'Page Analysis',
    description: 'Analyzes page content to extract topic, intent, and entities',
    category: 'discovery',
    inputs: [],
    outputs: 'PageAnalysis',
    canRunInParallel: false,
    estimatedDuration: 10,
    retryable: true,
    errorHandling: 'retry',
  },
  'query-generation': {
    id: 'query-generation',
    name: 'Query Generation',
    description: 'Generates target queries the page should answer',
    category: 'discovery',
    inputs: ['page-analysis'],
    outputs: 'TargetQuery[]',
    canRunInParallel: false,
    estimatedDuration: 15,
    retryable: true,
    errorHandling: 'retry',
  },
  'competitor-discovery': {
    id: 'competitor-discovery',
    name: 'Competitor Discovery',
    description: 'Identifies competing domains from search results',
    category: 'discovery',
    inputs: ['query-generation'],
    outputs: 'CompetitorVisibility[]',
    canRunInParallel: false,
    estimatedDuration: 5,
    retryable: true,
    errorHandling: 'skip',
  },

  // Research Agents
  'tavily-research': {
    id: 'tavily-research',
    name: 'Tavily Research',
    description: 'Searches queries via Tavily API',
    category: 'research',
    inputs: ['query-generation'],
    outputs: 'TavilySearchResult[]',
    canRunInParallel: true,
    estimatedDuration: 30,
    retryable: true,
    errorHandling: 'retry',
  },
  'google-aio': {
    id: 'google-aio',
    name: 'Google AI Overviews',
    description: 'Scrapes Google AI Overview results',
    category: 'research',
    inputs: ['query-generation'],
    outputs: 'GoogleAIOResult[]',
    canRunInParallel: true,
    estimatedDuration: 60,
    retryable: true,
    errorHandling: 'skip',
  },
  'perplexity': {
    id: 'perplexity',
    name: 'Perplexity Research',
    description: 'Queries Perplexity for citations',
    category: 'research',
    inputs: ['query-generation'],
    outputs: 'PerplexityResult[]',
    canRunInParallel: true,
    estimatedDuration: 45,
    retryable: true,
    errorHandling: 'skip',
  },
  'community-signals': {
    id: 'community-signals',
    name: 'Community Signals',
    description: 'Monitors Reddit, HN, GitHub for mentions',
    category: 'research',
    inputs: ['query-generation'],
    outputs: 'CommunitySignal[]',
    canRunInParallel: true,
    estimatedDuration: 40,
    retryable: true,
    errorHandling: 'skip',
  },

  // Analysis Agents
  'citation-analysis': {
    id: 'citation-analysis',
    name: 'Citation Analysis',
    description: 'Analyzes citation patterns and frequency',
    category: 'analysis',
    inputs: ['tavily-research', 'google-aio', 'perplexity'],
    outputs: 'CitationAnalysisResult',
    canRunInParallel: true,
    estimatedDuration: 10,
    retryable: true,
    errorHandling: 'retry',
  },
  'content-comparison': {
    id: 'content-comparison',
    name: 'Content Comparison',
    description: 'Compares content against competitors',
    category: 'analysis',
    inputs: ['page-analysis', 'competitor-discovery'],
    outputs: 'ContentComparisonResult',
    canRunInParallel: true,
    estimatedDuration: 20,
    retryable: true,
    errorHandling: 'retry',
  },
  'visibility-scoring': {
    id: 'visibility-scoring',
    name: 'Visibility Scoring',
    description: 'Calculates AEO visibility score',
    category: 'analysis',
    inputs: ['citation-analysis', 'content-comparison'],
    outputs: 'VisibilityScore',
    canRunInParallel: false,
    estimatedDuration: 5,
    retryable: true,
    errorHandling: 'retry',
  },

  // Output Agents
  'recommendations': {
    id: 'recommendations',
    name: 'Recommendations',
    description: 'Generates prioritized recommendations',
    category: 'output',
    inputs: ['visibility-scoring', 'content-comparison'],
    outputs: 'AEORecommendation[]',
    canRunInParallel: false,
    estimatedDuration: 15,
    retryable: true,
    errorHandling: 'retry',
  },
  'cursor-prompt': {
    id: 'cursor-prompt',
    name: 'Cursor Prompt',
    description: 'Generates ready-to-use Cursor prompt',
    category: 'output',
    inputs: ['recommendations'],
    outputs: 'CursorPrompt',
    canRunInParallel: false,
    estimatedDuration: 10,
    retryable: true,
    errorHandling: 'retry',
  },
  'report-generator': {
    id: 'report-generator',
    name: 'Report Generator',
    description: 'Generates final AEO report',
    category: 'output',
    inputs: ['cursor-prompt', 'recommendations'],
    outputs: 'AEOReport',
    canRunInParallel: false,
    estimatedDuration: 5,
    retryable: true,
    errorHandling: 'retry',
  },
};

// ===================
// Registry Functions
// ===================

/**
 * Get agent registry
 */
export function getAgentRegistry(): Record<string, AgentMetadata> {
  return { ...AGENT_REGISTRY };
}

/**
 * Get agent metadata
 */
export function getAgentMetadata(agentId: string): AgentMetadata | undefined {
  return AGENT_REGISTRY[agentId];
}

/**
 * Get agents by category
 */
export function getAgentsByCategory(category: AgentMetadata['category']): AgentMetadata[] {
  return Object.values(AGENT_REGISTRY).filter(agent => agent.category === category);
}

/**
 * Check if agent dependencies are satisfied
 */
export function areDependenciesSatisfied(
  agentId: string,
  completedAgents: Set<string>
): boolean {
  const agent = AGENT_REGISTRY[agentId];
  if (!agent) return false;

  return agent.inputs.every(input => completedAgents.has(input));
}

/**
 * Get agents that can run in parallel
 */
export function getParallelizableAgents(
  availableAgents: string[],
  completedAgents: Set<string>
): string[] {
  return availableAgents.filter(agentId => {
    const agent = AGENT_REGISTRY[agentId];
    if (!agent) return false;
    if (!agent.canRunInParallel) return false;
    return areDependenciesSatisfied(agentId, completedAgents);
  });
}
