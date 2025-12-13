"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  AlertTriangle,
  ChevronDown,
  Lightbulb,
  ExternalLink,
  Zap
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ContentGap {
  query: string;
  yourPosition: string;
  winningDomain: string;
  winningUrl: string;
  winningReason?: string;
  suggestedAction?: string;
}

interface ContentGapsProps {
  gaps: ContentGap[];
  missedOpportunities?: string[];
  topPerformingQueries?: string[];
  className?: string;
}

function getPriorityColor(position: string): string {
  if (position === "absent") return "border-red-500 bg-red-500/5";
  if (position === "mentioned") return "border-amber-500 bg-amber-500/5";
  return "border-gray-500 bg-gray-500/5";
}

function getPriorityLabel(position: string): string {
  if (position === "absent") return "High Impact";
  if (position === "mentioned") return "Medium Impact";
  return "Low Impact";
}

function getPriorityBadgeClass(position: string): string {
  if (position === "absent") return "bg-red-500/10 text-red-600 border-red-500/30";
  if (position === "mentioned") return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  return "bg-gray-500/10 text-gray-600 border-gray-500/30";
}

export function ContentGaps({ 
  gaps, 
  missedOpportunities,
  topPerformingQueries,
  className 
}: ContentGapsProps) {
  const [expandedGap, setExpandedGap] = useState<string | null>(null);

  // Group gaps by priority
  const highImpact = gaps.filter(g => g.yourPosition === "absent");
  const mediumImpact = gaps.filter(g => g.yourPosition === "mentioned");

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Content Gaps & Opportunities</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono">
            {gaps.length} gaps found
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <div className="text-2xl font-bold text-red-600">{highImpact.length}</div>
            <div className="text-xs text-muted-foreground mt-1">High Impact Gaps</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/30"
          >
            <div className="text-2xl font-bold text-amber-600">{mediumImpact.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Medium Impact Gaps</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
          >
            <div className="text-2xl font-bold text-emerald-600">{topPerformingQueries?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Top Performing</div>
          </motion.div>
        </div>

        {/* Gap list */}
        <div className="space-y-3">
          {gaps.map((gap, idx) => (
            <motion.div
              key={gap.query}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Collapsible
                open={expandedGap === gap.query}
                onOpenChange={() => setExpandedGap(expandedGap === gap.query ? null : gap.query)}
              >
                <CollapsibleTrigger asChild>
                  <div 
                    className={cn(
                      "w-full p-4 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md",
                      getPriorityColor(gap.yourPosition)
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getPriorityBadgeClass(gap.yourPosition))}
                          >
                            {getPriorityLabel(gap.yourPosition)}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          &ldquo;{gap.query}&rdquo;
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>Winner:</span>
                          <span className="font-medium text-foreground">{gap.winningDomain}</span>
                        </div>
                      </div>
                      <ChevronDown className={cn(
                        "h-5 w-5 text-muted-foreground transition-transform flex-shrink-0",
                        expandedGap === gap.query && "rotate-180"
                      )} />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 ml-4 p-4 rounded-lg bg-muted/50 space-y-3"
                  >
                    {gap.winningReason && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Lightbulb className="h-3 w-3" />
                          <span>Why they win</span>
                        </div>
                        <p className="text-sm">{gap.winningReason}</p>
                      </div>
                    )}
                    {gap.suggestedAction && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          <span>Suggested action</span>
                        </div>
                        <p className="text-sm font-medium text-primary">
                          {gap.suggestedAction}
                        </p>
                      </div>
                    )}
                    <a 
                      href={gap.winningUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      View winning content
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </motion.div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          ))}
        </div>

        {/* Missed opportunities */}
        {missedOpportunities && missedOpportunities.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-medium">Missed Opportunities</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {missedOpportunities.slice(0, 5).map((opp, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Badge variant="outline" className="text-xs bg-amber-500/5">
                    {opp.length > 50 ? opp.slice(0, 50) + "..." : opp}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Top performing queries */}
        {topPerformingQueries && topPerformingQueries.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              <h4 className="text-sm font-medium">Top Performing Queries</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {topPerformingQueries.map((query, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-600">
                    {query.length > 50 ? query.slice(0, 50) + "..." : query}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

