/**
 * Agent Executor
 *
 * Executes agents with parallelization support, dependency management,
 * and error handling.
 */

import { ContextManager, AgentContext } from './context';
import { getAgentMetadata, areDependenciesSatisfied } from './registry';
import { analyzePages, generateTargetQueries, discoverCompetitors } from './discovery';
import { researchQueries, analyzeCitations } from './research';
import { analyzeCitationPatterns, compareContent, calculateVisibilityScore, buildAEOAnalysis, CitationAnalysisResult, ContentComparisonResult } from './analysis';
import { generateAEORecommendations, generateCursorPrompt } from './output';
import { CrawledPage, PageAnalysis, TargetQuery, AEOAnalysis, TavilySearchResult, CompetitorVisibility, QueryCitation, AEORecommendation } from '../types';

// ===================
// Agent Execution Functions
// ===================

/**
 * Execute multiple agents (parallel or sequential)
 */
export async function executeAgents(
  agentIds: string[],
  runInParallel: boolean,
  context: ContextManager,
  tenantId: string,
  jobId: string,
  model: string = 'gpt-4o-mini'
): Promise<void> {
  if (runInParallel) {
    // Execute all agents in parallel
    await Promise.all(
      agentIds.map(agentId => executeAgent(agentId, context, tenantId, jobId, model))
    );
  } else {
    // Execute agents sequentially
    for (const agentId of agentIds) {
      await executeAgent(agentId, context, tenantId, jobId, model);
    }
  }
}

/**
 * Execute a single agent
 */
async function executeAgent(
  agentId: string,
  context: ContextManager,
  tenantId: string,
  jobId: string,
  model: string
): Promise<void> {
  const agentMetadata = getAgentMetadata(agentId);
  if (!agentMetadata) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  // Check dependencies
  const completedAgents = new Set(
    Object.values(context.getAllSummaries())
      .filter(s => s.status === 'completed')
      .map(s => s.agentId)
  );

  if (!areDependenciesSatisfied(agentId, completedAgents)) {
    throw new Error(`Dependencies not satisfied for agent: ${agentId}`);
  }

  try {
    // Execute agent based on ID
    const result = await runAgent(agentId, context, tenantId, jobId, model);

    // Store result in context
    await context.storeAgentResult(agentId, result, model);
  } catch (error) {
    context.markAgentFailed(agentId, (error as Error).message);
    throw error;
  }
}

/**
 * Run specific agent implementation
 * 
 * Note: This executor works with the actual agent function signatures.
 * Some agents need external data (like pages from crawler) which should
 * be stored in context before execution.
 */
async function runAgent(
  agentId: string,
  context: ContextManager,
  tenantId: string,
  jobId: string,
  model: string
): Promise<unknown> {
  const ctx = context.getContext();

  switch (agentId) {
    case 'page-analysis': {
      // Pages come from crawler, should be stored in context as 'pages' before this runs
      const pages = await context.getAgentResult<CrawledPage[]>('pages');
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        throw new Error('Pages not available in context. Ensure pages are stored before running page-analysis.');
      }
      return await analyzePages(pages, tenantId, jobId, model);
    }

    case 'query-generation': {
      const pageAnalysis = await context.getAgentResult<PageAnalysis>('page-analysis');
      if (!pageAnalysis) {
        throw new Error('Page analysis not available. Run page-analysis first.');
      }
      return await generateTargetQueries(pageAnalysis, ctx.domain, tenantId, jobId, {
        queryCount: 10,
        model,
      });
    }

    case 'competitor-discovery': {
      const targetQueries = await context.getAgentResult<TargetQuery[]>('query-generation');
      const searchResults = await context.getAgentResult<TavilySearchResult[]>('tavily-research');
      if (!targetQueries) {
        throw new Error('Target queries not available. Run query-generation first.');
      }
      return await discoverCompetitors(targetQueries, ctx.domain, tenantId, jobId, {
        searchResults: searchResults ?? undefined,
      });
    }

    case 'tavily-research': {
      const targetQueries = await context.getAgentResult<TargetQuery[]>('query-generation');
      if (!targetQueries) {
        throw new Error('Target queries not available. Run query-generation first.');
      }
      return await researchQueries(targetQueries, tenantId, jobId);
    }

    case 'google-aio': {
      const targetQueries = await context.getAgentResult<TargetQuery[]>('query-generation');
      if (!targetQueries) {
        throw new Error('Target queries not available. Run query-generation first.');
      }
      const { searchGoogleAIO } = await import('./research');
      return await searchGoogleAIO(targetQueries, ctx.domain, tenantId, jobId);
    }

    case 'perplexity': {
      const targetQueries = await context.getAgentResult<TargetQuery[]>('query-generation');
      if (!targetQueries) {
        throw new Error('Target queries not available. Run query-generation first.');
      }
      const { searchPerplexity } = await import('./research');
      return await searchPerplexity(targetQueries, ctx.domain, tenantId, jobId);
    }

    case 'community-signals': {
      const targetQueries = await context.getAgentResult<TargetQuery[]>('query-generation');
      if (!targetQueries) {
        throw new Error('Target queries not available. Run query-generation first.');
      }
      const { searchCommunitySignalsNew } = await import('./research');
      return await searchCommunitySignalsNew(targetQueries, ctx.domain, tenantId, jobId);
    }

    case 'citation-analysis': {
      // Need search results and domain to analyze citations
      const searchResults = await context.getAgentResult<TavilySearchResult[]>('tavily-research');
      if (!searchResults || !Array.isArray(searchResults)) {
        throw new Error('Search results not available. Run tavily-research first.');
      }
      
      // Analyze citations from search results
      const citations = analyzeCitations(searchResults, ctx.domain);
      
      // Store citations in context for later use
      await context.storeAgentResult('citations', citations, model);
      
      // Now run citation pattern analysis
      return await analyzeCitationPatterns(citations, searchResults, ctx.domain, tenantId, jobId);
    }

    case 'content-comparison': {
      const pageAnalysis = await context.getAgentResult<PageAnalysis>('page-analysis');
      const competitors = await context.getAgentResult<CompetitorVisibility[]>('competitor-discovery');
      const searchResults = await context.getAgentResult<TavilySearchResult[]>('tavily-research');
      if (!pageAnalysis) {
        throw new Error('Page analysis not available. Run page-analysis first.');
      }
      if (!competitors || !Array.isArray(competitors)) {
        throw new Error('Competitors not available. Run competitor-discovery first.');
      }
      return await compareContent(
        pageAnalysis,
        competitors,
        searchResults || [],
        tenantId,
        jobId,
        model
      );
    }

    case 'visibility-scoring': {
      const citationAnalysis = await context.getAgentResult<CitationAnalysisResult>('citation-analysis');
      const competitors = await context.getAgentResult<CompetitorVisibility[]>('competitor-discovery');
      const contentComparison = await context.getAgentResult<ContentComparisonResult>('content-comparison');
      if (!citationAnalysis) {
        throw new Error('Citation analysis not available. Run citation-analysis first.');
      }
      if (!competitors || !Array.isArray(competitors)) {
        throw new Error('Competitors not available. Run competitor-discovery first.');
      }
      if (!contentComparison) {
        throw new Error('Content comparison not available. Run content-comparison first.');
      }
      return await calculateVisibilityScore(
        citationAnalysis,
        competitors,
        contentComparison,
        tenantId,
        jobId
      );
    }

    case 'recommendations': {
      // Need to build AEO analysis from various sources
      const aeoAnalysis = await buildAEOAnalysisFromContext(context);
      const contentComparison = await context.getAgentResult<ContentComparisonResult>('content-comparison');
      if (!aeoAnalysis) {
        throw new Error('AEO analysis not available. Ensure all analysis agents have completed.');
      }
      if (!contentComparison) {
        throw new Error('Content comparison not available. Run content-comparison first.');
      }
      return await generateAEORecommendations(aeoAnalysis, contentComparison, tenantId, jobId, model);
    }

    case 'cursor-prompt': {
      const pageAnalysis = await context.getAgentResult<PageAnalysis>('page-analysis');
      const aeoAnalysis = await buildAEOAnalysisFromContext(context);
      const recommendations = await context.getAgentResult<AEORecommendation[]>('recommendations');
      if (!pageAnalysis) {
        throw new Error('Page analysis not available.');
      }
      if (!aeoAnalysis) {
        throw new Error('AEO analysis not available.');
      }
      if (!recommendations || !Array.isArray(recommendations)) {
        throw new Error('Recommendations not available. Run recommendations first.');
      }
      return await generateCursorPrompt(
        ctx.domain,
        pageAnalysis,
        aeoAnalysis,
        recommendations,
        tenantId,
        jobId,
        model
      );
    }

    case 'report-generator': {
      // This will be handled separately as it needs all data
      throw new Error('Report generator should be called separately with all data');
    }

    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

/**
 * Build AEO analysis from context (helper for recommendations and cursor-prompt)
 */
async function buildAEOAnalysisFromContext(context: ContextManager): Promise<AEOAnalysis | null> {
  const pageAnalysis = await context.getAgentResult<PageAnalysis>('page-analysis');
  const targetQueries = await context.getAgentResult<TargetQuery[]>('query-generation');
  const searchResults = await context.getAgentResult<TavilySearchResult[]>('tavily-research');
  const citations = await context.getAgentResult<QueryCitation[]>('citations');
  const competitors = await context.getAgentResult<CompetitorVisibility[]>('competitor-discovery');
  const visibilityScore = await context.getAgentResult<{ score: number }>('visibility-scoring');
  const citationAnalysis = await context.getAgentResult<CitationAnalysisResult>('citation-analysis');

  if (!pageAnalysis || !targetQueries || !searchResults || !citationAnalysis) {
    return null;
  }

  // Extract gaps from citation analysis if available
  const gaps = citationAnalysis.gaps || [];
  
  return buildAEOAnalysis(
    pageAnalysis,
    targetQueries,
    searchResults,
    citations || [],
    competitors || [],
    gaps,
    visibilityScore?.score || 0,
    citationAnalysis
  );
}
