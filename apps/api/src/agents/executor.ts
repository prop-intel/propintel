/**
 * Agent Executor
 *
 * Executes agents with parallelization support, dependency management,
 * and error handling.
 */

import { type ContextManager } from "./context";
import { getAgentMetadata, areDependenciesSatisfied } from "./registry";
import { DISABLED_AGENTS } from "./orchestrator/plan-generator";
import { withTimeout } from "../lib/tavily";

// Phase execution timeout - 3 minutes per phase (reduced since summaries no longer block)
const PHASE_TIMEOUT_MS = 180_000;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
import {
  analyzePages,
  generateTargetQueries,
  discoverCompetitors,
} from "./discovery";
import { researchQueries, analyzeCitations } from "./research";
import {
  analyzeCitationPatterns,
  compareContent,
  calculateVisibilityScore,
  buildAEOAnalysis,
  type CitationAnalysisResult,
  type ContentComparisonResult,
} from "./analysis";
import { generateAEORecommendations, generateCursorPrompt } from "./output";
import {
  type CrawledPage,
  type PageAnalysis,
  type TargetQuery,
  type AEOAnalysis,
  type TavilySearchResult,
  type CompetitorVisibility,
  type QueryCitation,
  type AEORecommendation,
  type CommunityEngagementResult,
} from "../types";

// ===================
// Helper Functions
// ===================

/**
 * Topologically sort agents by their dependencies
 * Also adds any missing required dependencies to ensure execution succeeds
 */
function sortAgentsByDependencies(
  agentIds: string[],
  completedAgents: Set<string>,
): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(agentId: string): void {
    if (visited.has(agentId)) return;
    if (completedAgents.has(agentId)) return; // Already completed in previous phase
    if (visiting.has(agentId)) {
      // Circular dependency - just add it (shouldn't happen with valid registry)
      return;
    }

    visiting.add(agentId);

    const metadata = getAgentMetadata(agentId);
    if (metadata) {
      // Visit ALL dependencies first (add missing ones automatically)
      for (const dep of metadata.inputs) {
        visit(dep);
      }
    }

    visiting.delete(agentId);
    visited.add(agentId);
    sorted.push(agentId);
  }

  for (const agentId of agentIds) {
    visit(agentId);
  }

  return sorted;
}

// ===================
// Retry Logic
// ===================

/**
 * Check if an error is retryable (transient failures)
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("socket hang up")
  );
}

/**
 * Execute an agent with retry logic for transient failures
 */
async function executeAgentWithRetry(
  agentId: string,
  context: ContextManager,
  tenantId: string,
  jobId: string,
  model: string,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(
          `[Executor] Retrying ${agentId} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }

      await executeAgent(agentId, context, tenantId, jobId, model);
      return; // Success
    } catch (error) {
      lastError = error as Error;

      // Only retry on transient errors
      if (!isRetryableError(lastError) || attempt >= MAX_RETRIES) {
        break;
      }

      console.warn(
        `[Executor] ${agentId} failed (retryable): ${lastError.message}`,
      );
    }
  }

  throw lastError || new Error(`Agent ${agentId} failed after retries`);
}

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
  model = "gpt-4o-mini",
): Promise<void> {
  // Get already completed agents at phase start
  const initialCompleted = new Set(
    Object.values(context.getAllSummaries())
      .filter((s) => s.status === "completed")
      .map((s) => s.agentId),
  );

  console.log(`[Executor] Starting phase with agents: ${agentIds.join(", ")}`);
  console.log(`[Executor] Run in parallel: ${runInParallel}`);
  console.log(
    `[Executor] Already completed at phase start: ${Array.from(initialCompleted).join(", ") || "none"}`,
  );

  // Sort agents by dependencies and add any missing required dependencies
  const sortedAgentIds = sortAgentsByDependencies(agentIds, initialCompleted);
  console.log(`[Executor] Sorted agent order: ${sortedAgentIds.join(", ")}`);

  // Helper to check if a dependency is satisfied (completed OR disabled)
  const isDependencySatisfied = (
    dep: string,
    completed: Set<string>,
  ): boolean => {
    return completed.has(dep) || DISABLED_AGENTS.has(dep);
  };

  if (runInParallel) {
    // For parallel execution, we need to be careful about dependencies
    // Only run agents whose dependencies are already satisfied
    const canRunNow: string[] = [];
    const mustWait: string[] = [];

    for (const agentId of sortedAgentIds) {
      const metadata = getAgentMetadata(agentId);
      if (
        metadata?.inputs.every((dep) =>
          isDependencySatisfied(dep, initialCompleted),
        )
      ) {
        canRunNow.push(agentId);
      } else {
        mustWait.push(agentId);
      }
    }

    console.log(
      `[Executor] Parallel execution - can run now: ${canRunNow.join(", ") || "none"}`,
    );
    console.log(
      `[Executor] Parallel execution - must wait: ${mustWait.join(", ") || "none"}`,
    );

    // Run the agents that can run in parallel (with timeout and retry)
    if (canRunNow.length > 0) {
      await withTimeout(
        Promise.all(
          canRunNow.map((agentId) =>
            executeAgentWithRetry(agentId, context, tenantId, jobId, model),
          ),
        ),
        PHASE_TIMEOUT_MS,
        `Phase execution timed out after ${PHASE_TIMEOUT_MS / 1000}s for agents: ${canRunNow.join(", ")}`,
      );
    }

    // If there are agents that must wait, run them sequentially
    // (their dependencies should now be satisfied from the parallel batch)
    // Re-check dependencies after parallel batch completes, as agents may depend on each other
    while (mustWait.length > 0) {
      // Get current completed agents (updated after parallel batch)
      const currentCompleted = new Set(
        Object.values(context.getAllSummaries())
          .filter((s) => s.status === "completed")
          .map((s) => s.agentId),
      );

      // Find agents that can run now (dependencies satisfied)
      const readyToRun: string[] = [];
      const stillWaiting: string[] = [];

      for (const agentId of mustWait) {
        const metadata = getAgentMetadata(agentId);
        if (metadata?.inputs.every((dep) => currentCompleted.has(dep))) {
          readyToRun.push(agentId);
        } else {
          stillWaiting.push(agentId);
        }
      }

      if (readyToRun.length === 0 && stillWaiting.length > 0) {
        // Deadlock: agents are waiting but none can run
        const waitingDetails = stillWaiting.map((id) => {
          const meta = getAgentMetadata(id);
          const missing =
            meta?.inputs.filter((dep) => !currentCompleted.has(dep)) || [];
          return `${id} (missing: ${missing.join(", ")})`;
        });
        throw new Error(
          `Deadlock detected: agents cannot proceed. Waiting: ${waitingDetails.join("; ")}. Completed: ${Array.from(currentCompleted).join(", ")}`,
        );
      }

      // Run ready agents in parallel with timeout and retry (they don't depend on each other)
      if (readyToRun.length > 0) {
        console.log(
          `[Executor] Running deferred agents that are now ready: ${readyToRun.join(", ")}`,
        );
        await withTimeout(
          Promise.all(
            readyToRun.map((agentId) =>
              executeAgentWithRetry(agentId, context, tenantId, jobId, model),
            ),
          ),
          PHASE_TIMEOUT_MS,
          `Deferred agent execution timed out after ${PHASE_TIMEOUT_MS / 1000}s for agents: ${readyToRun.join(", ")}`,
        );
      }

      // Update mustWait list for next iteration
      mustWait.length = 0;
      mustWait.push(...stillWaiting);
    }
  } else {
    // Execute agents sequentially in dependency order (with timeout and retry per agent)
    for (const agentId of sortedAgentIds) {
      // Log current state before each agent
      const currentCompleted = new Set(
        Object.values(context.getAllSummaries())
          .filter((s) => s.status === "completed")
          .map((s) => s.agentId),
      );
      console.log(
        `[Executor] Before ${agentId}, currently completed: ${Array.from(currentCompleted).join(", ") || "none"}`,
      );

      await withTimeout(
        executeAgentWithRetry(agentId, context, tenantId, jobId, model),
        PHASE_TIMEOUT_MS,
        `Agent ${agentId} timed out after ${PHASE_TIMEOUT_MS / 1000}s`,
      );

      console.log(`[Executor] Agent ${agentId} execution complete`);
    }
  }

  // Log final state
  const finalCompleted = new Set(
    Object.values(context.getAllSummaries())
      .filter((s) => s.status === "completed")
      .map((s) => s.agentId),
  );
  console.log(
    `[Executor] Phase complete. Now completed: ${Array.from(finalCompleted).join(", ")}`,
  );
}

/**
 * Execute a single agent
 */
async function executeAgent(
  agentId: string,
  context: ContextManager,
  tenantId: string,
  jobId: string,
  model: string,
): Promise<void> {
  console.log(`[Executor] >>> Starting agent: ${agentId}`);

  // Skip disabled/stub agents
  if (DISABLED_AGENTS.has(agentId)) {
    console.log(`[Executor] Skipping disabled agent: ${agentId}`);
    // Mark as completed with empty result so dependencies are satisfied
    await context.storeAgentResult(
      agentId,
      { skipped: true, reason: "Agent disabled" },
      model,
    );
    return;
  }

  const agentMetadata = getAgentMetadata(agentId);
  if (!agentMetadata) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  // Check dependencies
  const allSummaries = context.getAllSummaries();
  const completedAgents = new Set(
    Object.values(allSummaries)
      .filter((s) => s.status === "completed")
      .map((s) => s.agentId),
  );

  // Log diagnostic info for dependency checking
  console.log(`[Executor] Checking dependencies for agent: ${agentId}`);
  console.log(
    `[Executor] Required inputs: ${agentMetadata.inputs.join(", ") || "none"}`,
  );
  console.log(
    `[Executor] Completed agents: ${Array.from(completedAgents).join(", ") || "none"}`,
  );
  console.log(
    `[Executor] All summaries status: ${JSON.stringify(Object.entries(allSummaries).map(([k, v]) => `${k}:${v.status}`))}`,
  );

  if (!areDependenciesSatisfied(agentId, completedAgents)) {
    const missingDeps = agentMetadata.inputs.filter(
      (dep) => !completedAgents.has(dep),
    );
    console.error(
      `[Executor] Missing dependencies for ${agentId}: ${missingDeps.join(", ")}`,
    );
    throw new Error(
      `Dependencies not satisfied for agent: ${agentId}. Missing: ${missingDeps.join(", ")}. Completed: ${Array.from(completedAgents).join(", ")}`,
    );
  }

  try {
    // Execute agent based on ID
    console.log(`[Executor] Running agent implementation for: ${agentId}`);
    const result = await runAgent(agentId, context, tenantId, jobId, model);
    console.log(`[Executor] Agent ${agentId} returned result, storing...`);

    // Store result in context
    await context.storeAgentResult(agentId, result, model);
    console.log(`[Executor] <<< Agent ${agentId} completed successfully`);
  } catch (error) {
    console.error(
      `[Executor] <<< Agent ${agentId} FAILED:`,
      (error as Error).message,
    );
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
  model: string,
): Promise<unknown> {
  const ctx = context.getContext();

  switch (agentId) {
    case "page-analysis": {
      // Pages come from crawler, should be stored in context as 'crawled-pages' before this runs
      const pages =
        await context.getAgentResult<CrawledPage[]>("crawled-pages");
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        throw new Error(
          "Pages not available in context. Ensure pages are stored before running page-analysis.",
        );
      }
      return await analyzePages(pages, tenantId, jobId, model);
    }

    case "query-generation": {
      const pageAnalysis =
        await context.getAgentResult<PageAnalysis>("page-analysis");
      if (!pageAnalysis) {
        throw new Error(
          "Page analysis not available. Run page-analysis first.",
        );
      }
      return await generateTargetQueries(
        pageAnalysis,
        ctx.domain,
        tenantId,
        jobId,
        {
          queryCount: 10,
          model,
        },
      );
    }

    case "competitor-discovery": {
      const targetQueries =
        await context.getAgentResult<TargetQuery[]>("query-generation");
      const searchResults =
        await context.getAgentResult<TavilySearchResult[]>("tavily-research");
      const pageAnalysis =
        await context.getAgentResult<PageAnalysis>("page-analysis");
      if (!targetQueries) {
        throw new Error(
          "Target queries not available. Run query-generation first.",
        );
      }

      // Build business context from page analysis for smarter competitor filtering
      const businessContext = pageAnalysis
        ? {
            companyName: pageAnalysis.companyName || ctx.domain,
            businessCategory: pageAnalysis.businessCategory || "other",
            businessModel: pageAnalysis.businessModel || "",
            competitorProfile: pageAnalysis.competitorProfile || "",
          }
        : undefined;

      return await discoverCompetitors(
        targetQueries,
        ctx.domain,
        tenantId,
        jobId,
        {
          searchResults: searchResults ?? undefined,
          businessContext,
          model,
        },
      );
    }

    case "tavily-research": {
      const targetQueries =
        await context.getAgentResult<TargetQuery[]>("query-generation");
      if (!targetQueries) {
        throw new Error(
          "Target queries not available. Run query-generation first.",
        );
      }
      return await researchQueries(targetQueries, tenantId, jobId);
    }

    case "perplexity": {
      const targetQueries =
        await context.getAgentResult<TargetQuery[]>("query-generation");
      if (!targetQueries) {
        throw new Error(
          "Target queries not available. Run query-generation first.",
        );
      }
      const { searchPerplexity } = await import("./research");
      return await searchPerplexity(targetQueries, ctx.domain, tenantId, jobId);
    }

    case "community-signals": {
      const targetQueries =
        await context.getAgentResult<TargetQuery[]>("query-generation");
      if (!targetQueries) {
        throw new Error(
          "Target queries not available. Run query-generation first.",
        );
      }
      // Pass existing tavily-research results to avoid duplicate API calls
      const existingSearchResults =
        await context.getAgentResult<TavilySearchResult[]>("tavily-research");
      const { searchCommunitySignalsNew } = await import("./research");
      return await searchCommunitySignalsNew(
        targetQueries,
        ctx.domain,
        tenantId,
        jobId,
        existingSearchResults ?? undefined,
      );
    }

    case "citation-analysis": {
      const searchResults =
        await context.getAgentResult<TavilySearchResult[]>("tavily-research");
      const safeSearchResults = Array.isArray(searchResults)
        ? searchResults
        : [];

      if (safeSearchResults.length === 0) {
        // Return empty citation analysis when no search results
        const emptyCitationAnalysis: CitationAnalysisResult = {
          totalQueries: 0,
          citedQueries: 0,
          mentionedQueries: 0,
          absentQueries: 0,
          citationRate: 0,
          averageRank: 0,
          top3Count: 0,
          top3Rate: 0,
          queryTypesWinning: {} as unknown as Map<string, number>, // Use plain object (Maps serialize to objects)
          queryTypesLosing: {} as unknown as Map<string, number>,
          gaps: [],
          findings: [],
        };
        await context.storeAgentResult("citations", [], model);
        return emptyCitationAnalysis;
      }

      const citations = analyzeCitations(safeSearchResults, ctx.domain);
      await context.storeAgentResult("citations", citations, model);
      return await analyzeCitationPatterns(
        citations,
        safeSearchResults,
        ctx.domain,
        tenantId,
        jobId,
      );
    }

    case "content-comparison": {
      const pageAnalysis =
        await context.getAgentResult<PageAnalysis>("page-analysis");
      const competitors = await context.getAgentResult<CompetitorVisibility[]>(
        "competitor-discovery",
      );
      const searchResults =
        await context.getAgentResult<TavilySearchResult[]>("tavily-research");
      if (!pageAnalysis) {
        throw new Error(
          "Page analysis not available. Run page-analysis first.",
        );
      }
      const safeCompetitors = Array.isArray(competitors) ? competitors : [];
      return await compareContent(
        pageAnalysis,
        safeCompetitors,
        searchResults || [],
        tenantId,
        jobId,
        model,
      );
    }

    case "visibility-scoring": {
      let citationAnalysis =
        await context.getAgentResult<CitationAnalysisResult>(
          "citation-analysis",
        );
      const competitors = await context.getAgentResult<CompetitorVisibility[]>(
        "competitor-discovery",
      );
      const contentComparisonRaw = await context.getAgentResult<
        ContentComparisonResult | { skipped: boolean }
      >("content-comparison");

      if (!citationAnalysis) {
        citationAnalysis = {
          totalQueries: 0,
          citedQueries: 0,
          mentionedQueries: 0,
          absentQueries: 0,
          citationRate: 0,
          averageRank: 0,
          top3Count: 0,
          top3Rate: 0,
          queryTypesWinning: {} as unknown as Map<string, number>, // Use plain object (Maps serialize to objects)
          queryTypesLosing: {} as unknown as Map<string, number>,
          gaps: [],
          findings: [],
        };
      }
      const safeCompetitors = Array.isArray(competitors) ? competitors : [];

      // Handle skipped or missing content-comparison gracefully
      let contentComparison: ContentComparisonResult;
      if (
        !contentComparisonRaw ||
        ("skipped" in contentComparisonRaw && contentComparisonRaw.skipped)
      ) {
        console.log(
          "[Executor] content-comparison skipped or missing, using default",
        );
        contentComparison = {
          competitorInsights: [],
          contentGaps: [],
          structuralDifferences: [],
          recommendations: [
            "Content comparison was skipped - run full analysis for detailed recommendations",
          ],
        };
      } else {
        contentComparison = contentComparisonRaw as ContentComparisonResult;
      }

      return await calculateVisibilityScore(
        citationAnalysis,
        safeCompetitors,
        contentComparison,
        tenantId,
        jobId,
      );
    }

    case "recommendations": {
      console.log(`[Executor] Starting recommendations agent...`);
      // Need to build AEO analysis from various sources
      const aeoAnalysis = await buildAEOAnalysisFromContext(context);
      console.log(
        `[Executor] AEO analysis built:`,
        aeoAnalysis ? "success" : "null",
      );
      const contentComparisonRaw = await context.getAgentResult<
        ContentComparisonResult | { skipped: boolean }
      >("content-comparison");
      if (!aeoAnalysis) {
        throw new Error(
          "AEO analysis not available. Ensure all analysis agents have completed.",
        );
      }

      // Store AEO analysis for cursor-prompt to reuse (avoids 8 duplicate S3 calls)
      console.log(`[Executor] Storing AEO analysis for reuse by cursor-prompt...`);
      await context.storeAgentResult("aeo-analysis", aeoAnalysis, model);
      console.log(`[Executor] AEO analysis stored successfully`);

      // Handle skipped or missing content-comparison gracefully
      let contentComparison: ContentComparisonResult;
      if (
        !contentComparisonRaw ||
        ("skipped" in contentComparisonRaw && contentComparisonRaw.skipped)
      ) {
        console.log(
          "[Executor] content-comparison skipped or missing for recommendations, using default",
        );
        contentComparison = {
          competitorInsights: [],
          contentGaps: [],
          structuralDifferences: [],
          recommendations: [],
        };
      } else {
        contentComparison = contentComparisonRaw as ContentComparisonResult;
      }

      console.log(`[Executor] Calling generateAEORecommendations...`);
      return await generateAEORecommendations(
        aeoAnalysis,
        contentComparison,
        tenantId,
        jobId,
        model,
      );
    }

    case "cursor-prompt": {
      console.log(`[Executor] Starting cursor-prompt agent...`);
      const pageAnalysis =
        await context.getAgentResult<PageAnalysis>("page-analysis");
      console.log(`[Executor] page-analysis: ${pageAnalysis ? "found" : "null"}`);

      // Retrieve stored AEO analysis (built and stored by recommendations agent)
      console.log(`[Executor] Retrieving stored AEO analysis...`);
      const aeoAnalysis =
        await context.getAgentResult<AEOAnalysis>("aeo-analysis");
      console.log(`[Executor] aeo-analysis: ${aeoAnalysis ? "found" : "null"}`);

      const recommendations =
        await context.getAgentResult<AEORecommendation[]>("recommendations");
      console.log(`[Executor] recommendations: ${recommendations ? "found" : "null"}`);

      if (!pageAnalysis) {
        throw new Error("Page analysis not available.");
      }
      if (!aeoAnalysis) {
        throw new Error("AEO analysis not available. Ensure recommendations agent ran first.");
      }
      if (!recommendations || !Array.isArray(recommendations)) {
        throw new Error(
          "Recommendations not available. Run recommendations first.",
        );
      }
      console.log(`[Executor] Calling generateCursorPrompt...`);
      return await generateCursorPrompt(
        ctx.domain,
        pageAnalysis,
        aeoAnalysis,
        recommendations,
        tenantId,
        jobId,
        model,
      );
    }

    case "report-generator": {
      // This will be handled separately as it needs all data
      throw new Error(
        "Report generator should be called separately with all data",
      );
    }

    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

/**
 * Build AEO analysis from context (helper for recommendations and cursor-prompt)
 */
async function buildAEOAnalysisFromContext(
  context: ContextManager,
): Promise<AEOAnalysis | null> {
  console.log(`[Executor] Building AEO analysis from context...`);

  console.log(`[Executor] Retrieving page-analysis...`);
  const pageAnalysis =
    await context.getAgentResult<PageAnalysis>("page-analysis");
  console.log(`[Executor] page-analysis: ${pageAnalysis ? "found" : "null"}`);

  console.log(`[Executor] Retrieving query-generation...`);
  const targetQueries =
    await context.getAgentResult<TargetQuery[]>("query-generation");
  console.log(`[Executor] query-generation: ${targetQueries ? "found" : "null"}`);

  console.log(`[Executor] Retrieving tavily-research...`);
  const searchResults =
    await context.getAgentResult<TavilySearchResult[]>("tavily-research");
  console.log(`[Executor] tavily-research: ${searchResults ? "found" : "null"}`);

  console.log(`[Executor] Retrieving citations...`);
  const citations = await context.getAgentResult<QueryCitation[]>("citations");
  console.log(`[Executor] citations: ${citations ? "found" : "null"}`);

  console.log(`[Executor] Retrieving competitor-discovery...`);
  const competitors = await context.getAgentResult<CompetitorVisibility[]>(
    "competitor-discovery",
  );
  console.log(`[Executor] competitor-discovery: ${competitors ? "found" : "null"}`);

  console.log(`[Executor] Retrieving visibility-scoring...`);
  const visibilityScore = await context.getAgentResult<{ score: number }>(
    "visibility-scoring",
  );
  console.log(`[Executor] visibility-scoring: ${visibilityScore ? "found" : "null"}`);

  console.log(`[Executor] Retrieving citation-analysis...`);
  const citationAnalysis =
    await context.getAgentResult<CitationAnalysisResult>("citation-analysis");
  console.log(`[Executor] citation-analysis: ${citationAnalysis ? "found" : "null"}`);

  console.log(`[Executor] Retrieving community-signals...`);
  const communityEngagement =
    await context.getAgentResult<CommunityEngagementResult>(
      "community-signals",
    );
  console.log(`[Executor] community-signals: ${communityEngagement ? "found" : "null"}`);

  if (!pageAnalysis || !targetQueries || !searchResults || !citationAnalysis) {
    console.log(`[Executor] Missing required data for AEO analysis: pageAnalysis=${!!pageAnalysis}, targetQueries=${!!targetQueries}, searchResults=${!!searchResults}, citationAnalysis=${!!citationAnalysis}`);
    return null;
  }

  console.log(`[Executor] All required data found, building AEO analysis...`);

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
    citationAnalysis,
    communityEngagement ?? undefined,
  );
}
