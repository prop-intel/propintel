"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface AgentStatus {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  summary?: string;
  keyFindings?: string[];
  duration?: number;
}

export interface PipelinePhase {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  agents: AgentStatus[];
  parallel?: boolean;
  insights?: string[];
}

interface AgentPipelineProps {
  phases: PipelinePhase[];
  currentPhase?: string;
  className?: string;
}

function StepIcon({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
        <CheckCircle2 className="h-4 w-4 text-white" />
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500">
        <Circle className="h-3 w-3 fill-white text-white" />
      </div>
    );
  }
  return (
    <div className="border-muted-foreground/30 bg-background flex h-6 w-6 items-center justify-center rounded-full border-2">
      <Circle className="text-muted-foreground/30 fill-muted-foreground/30 h-2 w-2" />
    </div>
  );
}

const phaseIcons: Record<string, string> = {
  Discovery: "🔍",
  "Discovery-1": "🔍",
  "Discovery-2": "🔍",
  "Discovery-3": "🔍",
  Research: "📚",
  Analysis: "📊",
  "Analysis-1": "📊",
  "Analysis-2": "📊",
  Output: "📝",
  "Output-1": "📝",
  "Output-2": "📝",
};

function getPhaseIcon(phaseName: string): string {
  for (const [key, icon] of Object.entries(phaseIcons)) {
    if (phaseName.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  return "⚙️";
}

function getStatusTextColor(status: string) {
  switch (status) {
    case "completed":
      return "text-emerald-500";
    case "running":
      return "text-blue-500";
    case "failed":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

export function AgentPipeline({
  phases,
  currentPhase: _currentPhase,
  className,
}: AgentPipelineProps) {
  // Flatten all agents from all phases
  const activeAgents = phases.flatMap((p) => p.agents);

  // Count agents by status
  const completedCount = activeAgents.filter(
    (a) => a.status === "completed",
  ).length;
  const runningCount = activeAgents.filter(
    (a) => a.status === "running",
  ).length;
  const totalCount = activeAgents.length;

  // Determine overall status
  const isRunning =
    runningCount > 0 || phases.some((p) => p.status === "running");
  const isComplete = totalCount > 0 && completedCount === totalCount;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with live indicator */}
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">Analysis Progress</h3>
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            <span className="text-sm font-medium text-blue-500">
              Processing
            </span>
          </div>
        )}
        {isComplete && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-500">
              Complete
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <motion.div
            className={cn(
              "h-full rounded-full",
              isComplete ? "bg-emerald-500" : "bg-blue-500",
            )}
            initial={{ width: 0 }}
            animate={{
              width:
                totalCount > 0
                  ? `${((completedCount + runningCount * 0.5) / totalCount) * 100}%`
                  : "0%",
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Linear step list */}
      <div className="relative">
        {/* Vertical line connecting steps */}
        {activeAgents.length > 1 && (
          <div className="bg-border absolute bottom-6 left-3 top-6 w-px" />
        )}

        <AnimatePresence mode="popLayout">
          {activeAgents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-3"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              </div>
              <span className="text-muted-foreground text-sm">
                Starting analysis...
              </span>
            </motion.div>
          ) : (
            <div className="space-y-0">
              {activeAgents.map((agent) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                  }}
                  className="relative flex items-start gap-3 py-2"
                >
                  {/* Step icon */}
                  <div className="relative z-10 shrink-0">
                    <StepIcon status={agent.status} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          agent.status === "completed" && "text-emerald-600",
                          agent.status === "running" && "text-blue-600",
                          agent.status === "failed" && "text-red-600",
                          agent.status === "pending" && "text-muted-foreground",
                        )}
                      >
                        {agent.name}
                      </span>
                      {agent.duration && agent.status === "completed" && (
                        <span className="text-muted-foreground text-xs">
                          {agent.duration.toFixed(1)}s
                        </span>
                      )}
                    </div>
                    {agent.summary && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-muted-foreground mt-0.5 line-clamp-1 text-xs"
                      >
                        {agent.summary}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
