/**
 * Agent Executor
 *
 * Executes agents with parallelization support, dependency management,
 * and error handling.
 */

import { type ContextManager } from "./context";
import { getAgentMetadata, areDependenciesSatisfied } from "./registry";
import { DISABLED_AGENTS } from "./orchestrator/plan-generator";
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
  const isDependencySatisfied = (dep: string, completed: Set<string>): boolean => {
    return completed.has(dep) || DISABLED_AGENTS.has(dep);
  };

  if (runInParallel) {
    // For parallel execution, we need to be careful about dependencies
    // Only run agents whose dependencies are already satisfied
    const canRunNow: string[] = [];
    const mustWait: string[] = [];

    for (const agentId of sortedAgentIds) {
      const metadata = getAgentMetadata(agentId);
      if (metadata?.inputs.every((dep) => isDependencySatisfied(dep, initialCompleted))) {
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

    // Run the agents that can run in parallel
    if (canRunNow.length > 0) {
      await Promise.all(
        canRunNow.map((agentId) =>
          executeAgent(agentId, context, tenantId, jobId, model),
        ),
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

      // Run ready agents in parallel (they don't depend on each other)
      if (readyToRun.length > 0) {
        console.log(
          `[Executor] Running deferred agents that are now ready: ${readyToRun.join(", ")}`,
        );
        await Promise.all(
          readyToRun.map((agentId) =>
            executeAgent(agentId, context, tenantId, jobId, model),
          ),
        );
      }

      // Update mustWait list for next iteration
      mustWait.length = 0;
      mustWait.push(...stillWaiting);
    }
  } else {
    // Execute agents sequentially in dependency order
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

      await executeAgent(agentId, context, tenantId, jobId, model);

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
  model: string,
): Promise<unknown> {
  const ctx = context.getContext();

  switch (agentId) {
    case "page-analysis": {
      // Pages come from crawler, should be stored in context as 'pages' before this runs
      const pages = await context.getAgentResult<CrawledPage[]>("pages");
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
      const { searchCommunitySignalsNew } = await import("./research");
      return await searchCommunitySignalsNew(
        targetQueries,
        ctx.domain,
        tenantId,
        jobId,
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
      console.log(`[Executor] AEO analysis built:`, aeoAnalysis ? 'success' : 'null');
      const contentComparisonRaw = await context.getAgentResult<
        ContentComparisonResult | { skipped: boolean }
      >("content-comparison");
      if (!aeoAnalysis) {
        throw new Error(
          "AEO analysis not available. Ensure all analysis agents have completed.",
        );
      }

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
      const pageAnalysis =
        await context.getAgentResult<PageAnalysis>("page-analysis");
      const aeoAnalysis = await buildAEOAnalysisFromContext(context);
      const recommendations =
        await context.getAgentResult<AEORecommendation[]>("recommendations");
      if (!pageAnalysis) {
        throw new Error("Page analysis not available.");
      }
      if (!aeoAnalysis) {
        throw new Error("AEO analysis not available.");
      }
      if (!recommendations || !Array.isArray(recommendations)) {
        throw new Error(
          "Recommendations not available. Run recommendations first.",
        );
      }
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
  const pageAnalysis =
    await context.getAgentResult<PageAnalysis>("page-analysis");
  const targetQueries =
    await context.getAgentResult<TargetQuery[]>("query-generation");
  const searchResults =
    await context.getAgentResult<TavilySearchResult[]>("tavily-research");
  const citations = await context.getAgentResult<QueryCitation[]>("citations");
  const competitors = await context.getAgentResult<CompetitorVisibility[]>(
    "competitor-discovery",
  );
  const visibilityScore = await context.getAgentResult<{ score: number }>(
    "visibility-scoring",
  );
  const citationAnalysis =
    await context.getAgentResult<CitationAnalysisResult>("citation-analysis");
  const communityEngagement =
    await context.getAgentResult<CommunityEngagementResult>(
      "community-signals",
    );

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
    citationAnalysis,
    communityEngagement ?? undefined,
  );
}
