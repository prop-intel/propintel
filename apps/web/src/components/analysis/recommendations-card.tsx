"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Clock,
  Zap,
  Target,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ===================
// Types
// ===================

export interface AEORecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  category: "visibility" | "content" | "structure" | "authority";
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  targetQueries: string[];
  competitorExample?: {
    domain: string;
    url: string;
    whatTheyDoBetter: string;
  };
}

export interface RecommendationsCardProps {
  recommendations: AEORecommendation[];
  className?: string;
}

// ===================
// Helper Functions
// ===================

function getPriorityConfig(priority: AEORecommendation["priority"]) {
  switch (priority) {
    case "high":
      return {
        icon: ArrowUp,
        label: "High Priority",
        className: "bg-red-500/10 text-red-600 border-red-500/30",
        iconClassName: "text-red-500",
      };
    case "medium":
      return {
        icon: ArrowRight,
        label: "Medium Priority",
        className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
        iconClassName: "text-amber-500",
      };
    case "low":
      return {
        icon: ArrowDown,
        label: "Low Priority",
        className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
        iconClassName: "text-blue-500",
      };
  }
}

function getEffortConfig(effort: AEORecommendation["effort"]) {
  switch (effort) {
    case "low":
      return {
        icon: Zap,
        label: "Quick Win",
        className: "bg-green-500/10 text-green-600 border-green-500/30",
      };
    case "medium":
      return {
        icon: Clock,
        label: "Moderate Effort",
        className: "bg-gray-500/10 text-gray-600 border-gray-500/30",
      };
    case "high":
      return {
        icon: Clock,
        label: "Significant Effort",
        className: "bg-purple-500/10 text-purple-600 border-purple-500/30",
      };
  }
}

function getCategoryLabel(category: AEORecommendation["category"]) {
  switch (category) {
    case "visibility":
      return "Visibility";
    case "content":
      return "Content";
    case "structure":
      return "Structure";
    case "authority":
      return "Authority";
    default:
      return category;
  }
}

// ===================
// Main Component
// ===================

export function RecommendationsCard({
  recommendations,
  className,
}: RecommendationsCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group by priority
  const highPriority = recommendations.filter((r) => r.priority === "high");
  const mediumPriority = recommendations.filter((r) => r.priority === "medium");
  const lowPriority = recommendations.filter((r) => r.priority === "low");

  // Count quick wins
  const quickWins = recommendations.filter((r) => r.effort === "low").length;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AEO Recommendations</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {quickWins > 0 && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <Zap className="h-3 w-3 mr-1" />
                {quickWins} Quick Win{quickWins > 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="outline" className="font-mono">
              {recommendations.length} total
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Prioritized actions to improve your AI search visibility
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Priority summary */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <ArrowUp className="h-5 w-5 text-red-500" />
            <div>
              <div className="text-2xl font-bold text-red-600">{highPriority.length}</div>
              <div className="text-xs text-muted-foreground">High Priority</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30"
          >
            <ArrowRight className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-2xl font-bold text-amber-600">{mediumPriority.length}</div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30"
          >
            <ArrowDown className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{lowPriority.length}</div>
              <div className="text-xs text-muted-foreground">Low Priority</div>
            </div>
          </motion.div>
        </div>

        {/* Recommendations list */}
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recommendations generated yet.</p>
            <p className="text-sm mt-1">Complete an analysis to see recommendations.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => {
              const priorityConfig = getPriorityConfig(rec.priority);
              const effortConfig = getEffortConfig(rec.effort);
              const PriorityIcon = priorityConfig.icon;
              const EffortIcon = effortConfig.icon;

              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Collapsible
                    open={expandedId === rec.id}
                    onOpenChange={() =>
                      setExpandedId(expandedId === rec.id ? null : rec.id)
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <div className="w-full p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all hover:shadow-md">
                        <div className="flex items-start gap-3">
                          {/* Priority icon */}
                          <div className={cn("flex-shrink-0 mt-0.5", priorityConfig.iconClassName)}>
                            <PriorityIcon className="h-5 w-5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn("text-xs", priorityConfig.className)}
                              >
                                {priorityConfig.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", effortConfig.className)}
                              >
                                <EffortIcon className="h-3 w-3 mr-1" />
                                {effortConfig.label}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {getCategoryLabel(rec.category)}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {rec.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {rec.description}
                            </p>
                          </div>

                          {/* Expand icon */}
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform flex-shrink-0",
                              expandedId === rec.id && "rotate-180"
                            )}
                          />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-2 ml-8 p-4 rounded-lg bg-muted/50 space-y-4"
                      >
                        {/* Impact */}
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium">
                            Expected Impact
                          </div>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {rec.impact}
                          </p>
                        </div>

                        {/* Target Queries */}
                        {rec.targetQueries && rec.targetQueries.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                              <Target className="h-3 w-3" />
                              <span>Target Queries</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {rec.targetQueries.map((query, qIdx) => (
                                <Badge
                                  key={qIdx}
                                  variant="secondary"
                                  className="text-xs font-normal"
                                >
                                  &quot;{query}&quot;
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Competitor Example */}
                        {rec.competitorExample && (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground font-medium">
                              Competitor Example
                            </div>
                            <div className="p-3 rounded-md bg-background border">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">
                                  {rec.competitorExample.domain}
                                </span>
                                {rec.competitorExample.url && (
                                  <a
                                    href={rec.competitorExample.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {rec.competitorExample.whatTheyDoBetter}
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
