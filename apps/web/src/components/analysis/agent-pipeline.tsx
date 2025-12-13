"use client";

import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  Loader2, 
  Clock, 
  Circle,
  ArrowRight,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const phaseIcons: Record<string, string> = {
  "Discovery": "🔍",
  "Discovery-1": "🔍",
  "Discovery-2": "🔍",
  "Discovery-3": "🔍",
  "Research": "📚",
  "Analysis": "📊",
  "Analysis-1": "📊",
  "Analysis-2": "📊",
  "Output": "📝",
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

function AgentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "failed":
      return <Circle className="h-4 w-4 text-red-500 fill-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function AgentPipeline({ phases, currentPhase: _currentPhase, className }: AgentPipelineProps) {
  const completedPhases = phases.filter(p => p.status === "completed").length;
  const totalPhases = phases.length;
  const progress = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

  // Group phases by category
  const phaseCategories = [
    { name: "Discovery", phases: phases.filter(p => p.name.toLowerCase().includes("discovery")) },
    { name: "Research", phases: phases.filter(p => p.name.toLowerCase().includes("research")) },
    { name: "Analysis", phases: phases.filter(p => p.name.toLowerCase().includes("analysis")) },
    { name: "Output", phases: phases.filter(p => p.name.toLowerCase().includes("output")) },
  ].filter(c => c.phases.length > 0);

  // Get current insights from the latest running or completed phase
  const currentInsights = phases
    .filter(p => p.status === "completed" || p.status === "running")
    .flatMap(p => p.insights ?? [])
    .slice(-3);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Agent Pipeline</h3>
          {phases.some(p => p.status === "running") && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm text-emerald-500 font-medium">Live</span>
            </div>
          )}
        </div>
        <Badge variant="outline" className="font-mono">
          {completedPhases}/{totalPhases} phases
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}% complete</span>
          <span>{completedPhases} of {totalPhases} phases done</span>
        </div>
      </div>

      {/* Phase flow visualization */}
      <div className="flex items-center justify-between gap-2 py-4 overflow-x-auto">
        {phaseCategories.map((category, idx) => {
          const categoryStatus = category.phases.every(p => p.status === "completed")
            ? "completed"
            : category.phases.some(p => p.status === "running")
            ? "running"
            : category.phases.some(p => p.status === "failed")
            ? "failed"
            : "pending";

          return (
            <div key={category.name} className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "flex flex-col items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all min-w-[100px]",
                  categoryStatus === "completed" && "border-emerald-500 bg-emerald-500/10",
                  categoryStatus === "running" && "border-blue-500 bg-blue-500/10",
                  categoryStatus === "failed" && "border-red-500 bg-red-500/10",
                  categoryStatus === "pending" && "border-muted bg-muted/50"
                )}
              >
                <span className="text-2xl">{getPhaseIcon(category.name)}</span>
                <span className={cn(
                  "text-sm font-medium",
                  getStatusTextColor(categoryStatus)
                )}>
                  {category.name}
                </span>
                <AgentStatusIcon status={categoryStatus} />
              </motion.div>
              {idx < phaseCategories.length - 1 && (
                <ArrowRight className={cn(
                  "h-5 w-5 flex-shrink-0",
                  categoryStatus === "completed" ? "text-emerald-500" : "text-muted-foreground/30"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Active agents list */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Agent Activity
        </h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          <AnimatePresence mode="popLayout">
            {phases.flatMap(phase => 
              phase.agents.map(agent => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  layout
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    agent.status === "running" && "bg-blue-500/5 border-blue-500/30",
                    agent.status === "completed" && "bg-emerald-500/5 border-emerald-500/30",
                    agent.status === "failed" && "bg-red-500/5 border-red-500/30",
                    agent.status === "pending" && "bg-muted/30"
                  )}
                >
                  <AgentStatusIcon status={agent.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{agent.name}</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          agent.status === "completed" && "border-emerald-500/50 text-emerald-600",
                          agent.status === "running" && "border-blue-500/50 text-blue-600",
                          agent.status === "failed" && "border-red-500/50 text-red-600"
                        )}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    {agent.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {agent.summary}
                      </p>
                    )}
                  </div>
                  {agent.duration && (
                    <span className="text-xs text-muted-foreground">
                      {agent.duration.toFixed(1)}s
                    </span>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Current insights */}
      {currentInsights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Latest Insights</h4>
          <div className="space-y-2">
            {currentInsights.map((insight, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-3 bg-muted/50 rounded-lg border-l-4 border-blue-500"
              >
                <p className="text-sm">{insight}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

