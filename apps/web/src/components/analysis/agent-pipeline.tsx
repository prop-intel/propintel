"use client";

import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  Loader2, 
  Circle,
} from "lucide-react";
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
        <Loader2 className="h-4 w-4 text-white animate-spin" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500">
        <Circle className="h-3 w-3 text-white fill-white" />
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background">
      <Circle className="h-2 w-2 text-muted-foreground/30 fill-muted-foreground/30" />
    </div>
  );
}

export function AgentPipeline({ phases, className }: AgentPipelineProps) {
  // Flatten all agents into a single linear list
  const allAgents = phases.flatMap(phase => phase.agents);
  
  // Calculate progress based on completed agents
  const completedCount = allAgents.filter(a => a.status === "completed").length;
  const runningCount = allAgents.filter(a => a.status === "running").length;
  const totalCount = allAgents.length;
  
  // Show only agents that have started (running or completed or failed)
  const activeAgents = allAgents.filter(
    a => a.status === "running" || a.status === "completed" || a.status === "failed"
  );
  
  const isRunning = runningCount > 0;
  const isComplete = totalCount > 0 && completedCount === totalCount;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with live indicator */}
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">Analysis Progress</h3>
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-sm text-blue-500 font-medium">Processing</span>
          </div>
        )}
        {isComplete && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-emerald-500 font-medium">Complete</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              isComplete ? "bg-emerald-500" : "bg-blue-500"
            )}
            initial={{ width: 0 }}
            animate={{ 
              width: totalCount > 0 
                ? `${((completedCount + runningCount * 0.5) / totalCount) * 100}%` 
                : "0%" 
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Linear step list */}
      <div className="relative">
        {/* Vertical line connecting steps */}
        {activeAgents.length > 1 && (
          <div className="absolute left-3 top-6 bottom-6 w-px bg-border" />
        )}
        
        <AnimatePresence mode="popLayout">
          {activeAgents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-3"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              </div>
              <span className="text-sm text-muted-foreground">Starting analysis...</span>
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
                      ease: "easeOut"
                    }}
                    className="relative flex items-start gap-3 py-2"
                  >
                    {/* Step icon */}
                    <div className="relative z-10 flex-shrink-0">
                      <StepIcon status={agent.status} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium",
                          agent.status === "completed" && "text-emerald-600",
                          agent.status === "running" && "text-blue-600",
                          agent.status === "failed" && "text-red-600",
                          agent.status === "pending" && "text-muted-foreground"
                        )}>
                          {agent.name}
                        </span>
                        {agent.duration && agent.status === "completed" && (
                          <span className="text-xs text-muted-foreground">
                            {agent.duration.toFixed(1)}s
                          </span>
                        )}
                      </div>
                      {agent.summary && (
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
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

