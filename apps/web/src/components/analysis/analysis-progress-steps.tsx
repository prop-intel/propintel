"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  Circle,
  Search,
  FileText,
  Users,
  BarChart3,
  Lightbulb,
  Code2,
  Sparkles,
  MessageSquare,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Agent metadata for display
const AGENT_INFO: Record<
  string,
  { name: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  "page-analysis": {
    name: "Page Analysis",
    description: "Scanning and understanding your content",
    icon: FileText,
  },
  "query-generation": {
    name: "Query Generation",
    description: "Identifying target search queries",
    icon: Search,
  },
  "competitor-discovery": {
    name: "Competitor Discovery",
    description: "Finding your AI search competitors",
    icon: Users,
  },
  "tavily-research": {
    name: "AI Search Research",
    description: "Searching queries across AI engines",
    icon: Sparkles,
  },
  "community-signals": {
    name: "Community Signals",
    description: "Finding engagement opportunities",
    icon: MessageSquare,
  },
  "citation-analysis": {
    name: "Citation Analysis",
    description: "Analyzing where you appear in results",
    icon: BarChart3,
  },
  "content-comparison": {
    name: "Content Comparison",
    description: "Comparing your content vs competitors",
    icon: FileText,
  },
  "visibility-scoring": {
    name: "Visibility Scoring",
    description: "Calculating your AI visibility score",
    icon: BarChart3,
  },
  recommendations: {
    name: "Recommendations",
    description: "Generating actionable improvements",
    icon: Lightbulb,
  },
  "cursor-prompt": {
    name: "Cursor Prompt",
    description: "Creating your implementation guide",
    icon: Code2,
  },
  "report-generator": {
    name: "Report Generator",
    description: "Compiling final analysis report",
    icon: FileText,
  },
};

// Phase metadata
const PHASE_INFO: Record<string, { name: string; color: string }> = {
  Discovery: { name: "Discovery", color: "text-blue-500" },
  Research: { name: "Research", color: "text-purple-500" },
  Analysis: { name: "Analysis", color: "text-amber-500" },
  Scoring: { name: "Scoring", color: "text-emerald-500" },
  Output: { name: "Output", color: "text-cyan-500" },
};

interface AgentSummary {
  agentId: string;
  status: "pending" | "running" | "completed" | "failed";
  summary?: string;
  duration?: number;
}

interface ExecutionPhase {
  name: string;
  agents: string[];
  runInParallel: boolean;
}

interface ExecutionPlan {
  phases: ExecutionPhase[];
  estimatedDuration: number;
  reasoning: string;
}

interface AnalysisProgressStepsProps {
  executionPlan?: ExecutionPlan | null;
  agentSummaries?: Record<string, AgentSummary>;
  currentPhase?: string;
  status?: string;
  className?: string;
}

function StepIcon({
  status,
  AgentIcon,
}: {
  status: string;
  AgentIcon: React.ComponentType<{ className?: string }>;
}) {
  if (status === "completed") {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500"
      >
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      </motion.div>
    );
  }
  if (status === "running") {
    return (
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 ring-2 ring-blue-500">
        <motion.div
          className="absolute inset-0 rounded-full bg-blue-500/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <AgentIcon className="h-5 w-5 text-blue-500" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 ring-2 ring-red-500">
        <Circle className="h-4 w-4 text-red-500 fill-red-500" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-muted/30">
      <AgentIcon className="h-5 w-5 text-muted-foreground/40" />
    </div>
  );
}

function PhaseHeader({
  phaseName,
  isActive,
  isComplete,
}: {
  phaseName: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  const phaseInfo = PHASE_INFO[phaseName] ?? { name: phaseName, color: "text-primary" };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 mb-3"
    >
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive && "bg-blue-500 animate-pulse",
          isComplete && "bg-emerald-500",
          !isActive && !isComplete && "bg-muted-foreground/30"
        )}
      />
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          isActive && phaseInfo.color,
          isComplete && "text-emerald-600",
          !isActive && !isComplete && "text-muted-foreground/50"
        )}
      >
        {phaseInfo.name}
      </span>
      {isActive && (
        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      )}
      {isComplete && (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      )}
    </motion.div>
  );
}

export function AnalysisProgressSteps({
  executionPlan,
  agentSummaries = {},
  currentPhase: _currentPhase,
  status,
  className,
}: AnalysisProgressStepsProps) {
  // Build phases from execution plan or use defaults
  const phases = executionPlan?.phases ?? [
    { name: "Discovery", agents: ["page-analysis", "query-generation", "competitor-discovery"], runInParallel: false },
    { name: "Research", agents: ["tavily-research", "community-signals"], runInParallel: true },
    { name: "Analysis", agents: ["citation-analysis", "content-comparison"], runInParallel: true },
    { name: "Scoring", agents: ["visibility-scoring"], runInParallel: false },
    { name: "Output", agents: ["recommendations", "cursor-prompt"], runInParallel: false },
  ];

  // Check if failed/blocked
  const isFailed = status === "failed" || status === "blocked";

  // Calculate overall progress
  const allAgents = phases.flatMap((p) => p.agents);
  const completedCount = allAgents.filter(
    (a) => agentSummaries[a]?.status === "completed"
  ).length;
  const runningCount = allAgents.filter(
    (a) => agentSummaries[a]?.status === "running"
  ).length;
  const failedCount = allAgents.filter(
    (a) => agentSummaries[a]?.status === "failed"
  ).length;
  const totalCount = allAgents.length;

  const progress =
    totalCount > 0 ? ((completedCount + runningCount * 0.5) / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount && totalCount > 0 && !isFailed;

  // Determine which phases are active/complete
  const phaseStatuses = phases.map((phase) => {
    const agentStatuses = phase.agents.map(
      (a) => agentSummaries[a]?.status ?? "pending"
    );
    const allComplete = agentStatuses.every((s) => s === "completed");
    const anyRunning = agentStatuses.some((s) => s === "running");
    const anyComplete = agentStatuses.some((s) => s === "completed");

    return {
      isComplete: allComplete,
      isActive: anyRunning || (anyComplete && !allComplete),
    };
  });

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              {isFailed ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-blue-500" />
                  {!isComplete && (
                    <motion.div
                      className="absolute -inset-1 rounded-full bg-blue-500/20"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </>
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {isFailed ? "Analysis Failed" : "AI Analysis Running"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isFailed
                  ? `${completedCount} agents completed before failure`
                  : isComplete
                  ? "Analysis complete!"
                  : `${completedCount} of ${totalCount} agents complete`}
              </p>
            </div>
          </div>
          {!isComplete && !isFailed && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span className="text-sm font-medium text-blue-500">Live</span>
            </div>
          )}
          {isFailed && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">Failed</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                isFailed ? "bg-red-500" : isComplete ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-purple-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>{Math.round(progress)}% complete</span>
            {executionPlan?.estimatedDuration && !isComplete && !isFailed && (
              <span>~{Math.ceil(executionPlan.estimatedDuration / 60)} min remaining</span>
            )}
            {isFailed && failedCount > 0 && (
              <span className="text-red-500">{failedCount} agent{failedCount > 1 ? 's' : ''} failed</span>
            )}
          </div>
        </div>

        {/* Failed alert */}
        {isFailed && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>
              The analysis encountered an error and could not complete. You can try starting a new analysis.
            </AlertDescription>
          </Alert>
        )}

        {/* Phases and Agents */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {phases.map((phase, phaseIndex) => {
              const { isActive, isComplete: phaseComplete } = phaseStatuses[phaseIndex] ?? {};

              return (
                <motion.div
                  key={phase.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: phaseIndex * 0.1 }}
                >
                  <PhaseHeader
                    phaseName={phase.name}
                    isActive={isActive ?? false}
                    isComplete={phaseComplete ?? false}
                  />

                  <div className="ml-0.5 space-y-3">
                    {phase.agents.map((agentId, agentIndex) => {
                      const agentInfo = AGENT_INFO[agentId] ?? {
                        name: agentId,
                        description: "",
                        icon: Circle,
                      };
                      const AgentIcon = agentInfo.icon;
                      const status = agentSummaries[agentId]?.status ?? "pending";
                      const summary = agentSummaries[agentId]?.summary;
                      const duration = agentSummaries[agentId]?.duration;

                      return (
                        <motion.div
                          key={agentId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: phaseIndex * 0.1 + agentIndex * 0.05 }}
                          className={cn(
                            "flex items-start gap-4 p-3 rounded-lg transition-colors",
                            status === "running" && "bg-blue-500/5 border border-blue-500/20",
                            status === "completed" && "bg-emerald-500/5",
                            status === "pending" && "opacity-50"
                          )}
                        >
                          <StepIcon status={status} AgentIcon={AgentIcon} />

                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "font-medium",
                                  status === "completed" && "text-emerald-600",
                                  status === "running" && "text-blue-600",
                                  status === "failed" && "text-red-600",
                                  status === "pending" && "text-muted-foreground"
                                )}
                              >
                                {agentInfo.name}
                              </span>
                              {duration && status === "completed" && (
                                <span className="text-xs text-muted-foreground">
                                  {duration.toFixed(1)}s
                                </span>
                              )}
                            </div>

                            {status === "running" ? (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-muted-foreground flex items-center gap-2"
                              >
                                <span>{agentInfo.description}</span>
                                <motion.span
                                  animate={{ opacity: [0.4, 1, 0.4] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                  ...
                                </motion.span>
                              </motion.p>
                            ) : status === "completed" && summary ? (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-muted-foreground line-clamp-1"
                              >
                                {summary}
                              </motion.p>
                            ) : status === "pending" ? (
                              <p className="text-sm text-muted-foreground/60">
                                {agentInfo.description}
                              </p>
                            ) : null}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

