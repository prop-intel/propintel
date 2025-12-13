"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, CheckCircle2, AlertCircle, XCircle, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

interface CitationChartProps {
  citations: Array<{
    query: string;
    yourPosition: "cited" | "mentioned" | "absent";
    yourRank?: number;
  }>;
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
  const citedCount = citations.filter(c => c.yourPosition === "cited").length;
  const mentionedCount = citations.filter(c => c.yourPosition === "mentioned").length;
  const absentCount = citations.filter(c => c.yourPosition === "absent").length;
  
  const top3Count = citations.filter(c => c.yourRank && c.yourRank <= 3).length;
  const top5Count = citations.filter(c => c.yourRank && c.yourRank <= 5).length;

  const total = citations.length || 1;

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
      </CardContent>
    </Card>
  );
}

