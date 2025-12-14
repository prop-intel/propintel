"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  Trophy,
  Link2,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TopResult {
  domain: string;
  url: string;
  rank: number;
}

interface Citation {
  query: string;
  yourPosition: "cited" | "mentioned" | "absent";
  yourRank?: number;
  topResults?: TopResult[];
  winningDomain?: string;
  winningReason?: string;
}

interface CitationChartProps {
  citations: Citation[];
  visibilityScore: number;
  queriesAnalyzed: number;
  citationRate: number;
  className?: string;
}

export function CitationChart({ 
  citations, 
  visibilityScore, 
  queriesAnalyzed, 
  citationRate,
  className 
}: CitationChartProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [showAllCitations, setShowAllCitations] = useState(false);

  const citedCount = citations.filter(c => c.yourPosition === "cited").length;
  const mentionedCount = citations.filter(c => c.yourPosition === "mentioned").length;
  const absentCount = citations.filter(c => c.yourPosition === "absent").length;
  
  const top3Count = citations.filter(c => c.yourRank && c.yourRank <= 3).length;
  const top5Count = citations.filter(c => c.yourRank && c.yourRank <= 5).length;

  const total = citations.length || 1;

  // Get citations where we appear (cited or mentioned)
  const citedCitations = citations.filter(c => c.yourPosition === "cited" || c.yourPosition === "mentioned");
  const displayedCitations = showAllCitations ? citedCitations : citedCitations.slice(0, 5);

  const segments = [
    { label: "Cited", count: citedCount, color: "bg-emerald-500", percentage: (citedCount / total) * 100 },
    { label: "Mentioned", count: mentionedCount, color: "bg-amber-500", percentage: (mentionedCount / total) * 100 },
    { label: "Absent", count: absentCount, color: "bg-red-500", percentage: (absentCount / total) * 100 },
  ];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Citation Analysis</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-4 rounded-lg bg-muted/50"
          >
            <div className="text-3xl font-bold text-foreground">{visibilityScore}%</div>
            <div className="text-xs text-muted-foreground mt-1">Visibility Score</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center p-4 rounded-lg bg-muted/50"
          >
            <div className="text-3xl font-bold text-foreground">{queriesAnalyzed}</div>
            <div className="text-xs text-muted-foreground mt-1">Queries Analyzed</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center p-4 rounded-lg bg-muted/50"
          >
            <div className="text-3xl font-bold text-foreground">{citedCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Times Cited</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center p-4 rounded-lg bg-muted/50"
          >
            <div className="text-3xl font-bold text-foreground">{citationRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">Citation Rate</div>
          </motion.div>
        </div>

        {/* Visibility bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your Visibility</span>
            <span className="font-medium">{citationRate}% of searches</span>
          </div>
          <div className="h-4 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                citationRate >= 50 ? "bg-emerald-500" :
                citationRate >= 30 ? "bg-amber-500" :
                "bg-red-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${citationRate}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Position breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Citation Position Breakdown</h4>
          <div className="grid grid-cols-5 gap-3">
            {segments.map((segment, idx) => (
              <motion.div
                key={segment.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                  segment.color
                )}>
                  {segment.count}
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium">{segment.label}</div>
                  <div className="text-xs text-muted-foreground">{segment.percentage.toFixed(0)}%</div>
                </div>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-blue-500">
                {top3Count}
              </div>
              <div className="text-center">
                <div className="text-xs font-medium">Top 3</div>
                <div className="text-xs text-muted-foreground">{((top3Count / total) * 100).toFixed(0)}%</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-purple-500">
                {top5Count}
              </div>
              <div className="text-center">
                <div className="text-xs font-medium">Top 5</div>
                <div className="text-xs text-muted-foreground">{((top5Count / total) * 100).toFixed(0)}%</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Horizontal bar chart */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Position Distribution</h4>
          <div className="space-y-2">
            {segments.map((segment, idx) => (
              <div key={segment.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {segment.label === "Cited" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    {segment.label === "Mentioned" && <AlertCircle className="h-3 w-3 text-amber-500" />}
                    {segment.label === "Absent" && <XCircle className="h-3 w-3 text-red-500" />}
                    <span>{segment.label}</span>
                  </div>
                  <span className="font-mono">{segment.count} ({segment.percentage.toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", segment.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${segment.percentage}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Citation Links - Where you appear */}
        {citedCitations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Where You Appear</h4>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {citedCitations.length} queries
              </Badge>
            </div>
            <div className="space-y-2">
              {displayedCitations.map((citation, idx) => {
                const uniqueId = `${citation.query}-${idx}`;
                const isExpanded = expandedQuery === uniqueId;

                return (
                  <motion.div
                    key={uniqueId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => setExpandedQuery(isExpanded ? null : uniqueId)}
                    >
                      <div className="rounded-lg border bg-card overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="w-full p-3 hover:bg-accent/50 cursor-pointer transition-colors">
                            <div className="flex items-center gap-3">
                              {/* Position indicator */}
                              <div className={cn(
                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                                citation.yourPosition === "cited" ? "bg-emerald-500" : "bg-amber-500"
                              )}>
                                {citation.yourRank ? `#${citation.yourRank}` : "—"}
                              </div>

                              {/* Query */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  &quot;{citation.query}&quot;
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      citation.yourPosition === "cited"
                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                        : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                    )}
                                  >
                                    {citation.yourPosition === "cited" ? (
                                      <><CheckCircle2 className="h-3 w-3 mr-1" />Cited</>
                                    ) : (
                                      <><AlertCircle className="h-3 w-3 mr-1" />Mentioned</>
                                    )}
                                  </Badge>
                                  {citation.topResults && citation.topResults.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      {citation.topResults.length} sources
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Expand icon */}
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                                  isExpanded && "rotate-180"
                                )}
                              />
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                            {citation.winningReason && (
                              <p className="text-xs text-muted-foreground mb-2 italic">
                                {citation.winningReason}
                              </p>
                            )}
                            {citation.topResults && citation.topResults.length > 0 ? (
                              <div className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                  Top Sources for this Query:
                                </div>
                                {citation.topResults.slice(0, 5).map((result, rIdx) => (
                                  <a
                                    key={rIdx}
                                    href={result.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-background transition-colors group"
                                  >
                                    <div className={cn(
                                      "flex-shrink-0 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center",
                                      result.rank === 1 ? "bg-yellow-500 text-yellow-950" :
                                      result.rank === 2 ? "bg-gray-300 text-gray-700" :
                                      result.rank === 3 ? "bg-amber-600 text-amber-100" :
                                      "bg-muted text-muted-foreground"
                                    )}>
                                      {result.rank}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-foreground group-hover:text-blue-600 truncate">
                                        {result.domain}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        {result.url}
                                      </p>
                                    </div>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-blue-600 flex-shrink-0" />
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No source details available</p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  </motion.div>
                );
              })}
            </div>
            {citedCitations.length > 5 && (
              <button
                onClick={() => setShowAllCitations(!showAllCitations)}
                className="w-full text-center text-sm text-primary hover:underline py-2"
              >
                {showAllCitations ? "Show less" : `Show all ${citedCitations.length} citations`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

