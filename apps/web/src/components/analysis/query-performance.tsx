"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  ChevronDown,
  ChevronUp,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface TargetQuery {
  query: string;
  type: string;
  relevanceScore: number;
}

interface Citation {
  query: string;
  yourPosition: "cited" | "mentioned" | "absent";
  yourRank?: number;
  topResults?: Array<{
    domain: string;
    url: string;
    rank: number;
  }>;
  winningDomain?: string;
  winningReason?: string;
}

interface QueryPerformanceProps {
  targetQueries: TargetQuery[];
  citations: Citation[];
  className?: string;
}

const queryTypeColors: Record<string, string> = {
  "best": "bg-purple-500/10 text-purple-600 border-purple-500/30",
  "how-to": "bg-blue-500/10 text-blue-600 border-blue-500/30",
  "what-is": "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  "why": "bg-amber-500/10 text-amber-600 border-amber-500/30",
  "comparison": "bg-rose-500/10 text-rose-600 border-rose-500/30",
  "other": "bg-gray-500/10 text-gray-600 border-gray-500/30",
};

function getPositionIcon(position: string) {
  switch (position) {
    case "cited":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "mentioned":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default:
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function getPositionLabel(position: string, rank?: number) {
  switch (position) {
    case "cited":
      return rank ? `#${rank}` : "Cited";
    case "mentioned":
      return rank ? `#${rank}` : "Mentioned";
    default:
      return "N/A";
  }
}

function getPositionBadgeClass(position: string) {
  switch (position) {
    case "cited":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "mentioned":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    default:
      return "bg-red-500/10 text-red-600 border-red-500/30";
  }
}

export function QueryPerformance({ targetQueries, citations, className }: QueryPerformanceProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);

  // Merge query data with citation data
  const mergedQueries = targetQueries.map(query => {
    const citation = citations.find(c => c.query === query.query);
    return {
      ...query,
      position: citation?.yourPosition ?? "absent",
      rank: citation?.yourRank,
      topResults: citation?.topResults,
      winningDomain: citation?.winningDomain,
      winningReason: citation?.winningReason,
    };
  });

  // Stats
  const citedCount = mergedQueries.filter(q => q.position === "cited").length;
  const mentionedCount = mergedQueries.filter(q => q.position === "mentioned").length;
  const absentCount = mergedQueries.filter(q => q.position === "absent").length;

  const displayQueries = expanded ? mergedQueries : mergedQueries.slice(0, 5);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Target Queries & Performance</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>{citedCount} cited</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span>{mentionedCount} mentioned</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>{absentCount} absent</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-4 text-xs text-muted-foreground font-medium border-b pb-2">
          <div className="col-span-6">Query</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2 text-center">Relevance</div>
          <div className="col-span-2 text-center">Position</div>
        </div>

        {/* Query rows */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {displayQueries.map((query, idx) => (
              <motion.div
                key={query.query}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: idx * 0.03 }}
                className="space-y-2"
              >
                <div 
                  className={cn(
                    "grid grid-cols-12 gap-4 items-center py-3 px-2 rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
                    selectedQuery === query.query && "bg-muted/50"
                  )}
                  onClick={() => setSelectedQuery(selectedQuery === query.query ? null : query.query)}
                >
                  <div className="col-span-6 flex items-center gap-2">
                    {getPositionIcon(query.position)}
                    <span className="text-sm truncate">{query.query}</span>
                  </div>
                  <div className="col-span-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs capitalize",
                        queryTypeColors[query.type] ?? queryTypeColors.other
                      )}
                    >
                      {query.type}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${query.relevanceScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">
                        {query.relevanceScore}%
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs font-mono",
                        getPositionBadgeClass(query.position)
                      )}
                    >
                      {getPositionLabel(query.position, query.rank)}
                    </Badge>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {selectedQuery === query.query && query.topResults && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-6 pl-4 border-l-2 border-muted space-y-2"
                    >
                      <p className="text-xs text-muted-foreground font-medium">Top Results:</p>
                      {query.topResults.slice(0, 5).map((result, ridx) => (
                        <div 
                          key={ridx} 
                          className={cn(
                            "flex items-center gap-2 text-xs py-1.5 px-2 rounded",
                            result.domain.includes("gauntlet") && "bg-emerald-500/10"
                          )}
                        >
                          <span className="font-mono text-muted-foreground w-6">#{result.rank}</span>
                          <span className={cn(
                            "truncate flex-1",
                            result.domain.includes("gauntlet") && "font-medium text-emerald-600"
                          )}>
                            {result.domain}
                          </span>
                        </div>
                      ))}
                      {query.winningDomain && query.position === "absent" && (
                        <div className="pt-2 border-t border-muted mt-2">
                          <p className="text-xs">
                            <span className="text-muted-foreground">Winner: </span>
                            <span className="font-medium">{query.winningDomain}</span>
                          </p>
                          {query.winningReason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Reason: {query.winningReason}
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Expand/collapse button */}
        {mergedQueries.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show All {mergedQueries.length} Queries
              </>
            )}
          </Button>
        )}

        {/* Legend */}
        <div className="pt-4 border-t flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="text-muted-foreground">Cited (Top 3)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 text-amber-500" />
            <span className="text-muted-foreground">Mentioned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3 w-3 text-red-500" />
            <span className="text-muted-foreground">Absent</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

