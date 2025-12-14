"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Competitor {
  domain: string;
  citationCount: number;
  citationRate: number;
  averageRank: number;
  topQueries?: string[];
  strengths?: string[];
}

interface CompetitorLandscapeProps {
  competitors: Competitor[];
  yourDomain: string;
  yourCitationRate: number;
  yourAverageRank?: number;
  className?: string;
}

function getMedalEmoji(rank: number): string {
  switch (rank) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
    default: return `${rank}.`;
  }
}

function getRankColor(rank: number): string {
  switch (rank) {
    case 1: return "text-yellow-500";
    case 2: return "text-gray-400";
    case 3: return "text-amber-600";
    default: return "text-muted-foreground";
  }
}

export function CompetitorLandscape({ 
  competitors, 
  yourDomain,
  yourCitationRate,
  yourAverageRank,
  className 
}: CompetitorLandscapeProps) {
  const [sortBy, setSortBy] = useState<"citationRate" | "averageRank" | "citationCount">("citationRate");
  const [showAll, setShowAll] = useState(false);

  // Sort competitors
  const sortedCompetitors = [...competitors].sort((a, b) => {
    if (sortBy === "citationRate") return b.citationRate - a.citationRate;
    if (sortBy === "averageRank") return a.averageRank - b.averageRank;
    return b.citationCount - a.citationCount;
  });

  // Find your position
  const yourPosition = sortedCompetitors.findIndex(c => c.domain === yourDomain) + 1;
  const isYouInList = yourPosition > 0;

  // Add "you" to the list if not present
  const displayCompetitors = showAll ? sortedCompetitors : sortedCompetitors.slice(0, 6);

  // Max values for bar scaling
  const maxCitationRate = Math.max(...competitors.map(c => c.citationRate), yourCitationRate);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Competitor Landscape</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant={sortBy === "citationRate" ? "secondary" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setSortBy("citationRate")}
            >
              Citation Rate
            </Button>
            <Button
              variant={sortBy === "averageRank" ? "secondary" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setSortBy("averageRank")}
            >
              Avg Rank
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 text-xs text-muted-foreground font-medium border-b pb-2">
          <div className="col-span-1"></div>
          <div className="col-span-4">Domain</div>
          <div className="col-span-3">Citation Rate</div>
          <div className="col-span-2 text-center">Avg Rank</div>
          <div className="col-span-2 text-center">Appearances</div>
        </div>

        {/* Competitor rows */}
        <div className="space-y-2">
          {displayCompetitors.map((competitor, idx) => {
            const isYou = competitor.domain.toLowerCase() === yourDomain.toLowerCase();
            const barWidth = (competitor.citationRate / maxCitationRate) * 100;
            
            return (
              <motion.div
                key={competitor.domain}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "grid grid-cols-12 gap-4 items-center py-3 px-2 rounded-lg transition-all",
                  isYou && "bg-primary/10 border border-primary/30"
                )}
              >
                <div className="col-span-1 text-center">
                  <span className={cn("font-medium", getRankColor(idx + 1))}>
                    {getMedalEmoji(idx + 1)}
                  </span>
                </div>
                <div className="col-span-4 flex items-center gap-2">
                  <a
                    href={`https://${competitor.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "text-sm truncate hover:underline inline-flex items-center gap-1 group",
                      isYou ? "font-semibold text-primary" : "hover:text-blue-600"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {competitor.domain}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  {isYou && (
                    <Badge variant="outline" className="text-xs bg-primary/10">
                      You
                    </Badge>
                  )}
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          isYou ? "bg-primary" : "bg-blue-500"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.05 }}
                      />
                    </div>
                    <span className="text-xs font-mono w-12 text-right">
                      {competitor.citationRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <Badge variant="outline" className="font-mono">
                    #{competitor.averageRank.toFixed(1)}
                  </Badge>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-sm font-medium">{competitor.citationCount}</span>
                </div>
              </motion.div>
            );
          })}

          {/* Your position if not in top list */}
          {!isYouInList && (
            <>
              <div className="border-t border-dashed my-2" />
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-12 gap-4 items-center py-3 px-2 rounded-lg bg-primary/10 border border-primary/30"
              >
                <div className="col-span-1 text-center">
                  <span className="text-muted-foreground">📍</span>
                </div>
                <div className="col-span-4 flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary truncate">
                    {yourDomain}
                  </span>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    You
                  </Badge>
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${(yourCitationRate / maxCitationRate) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="text-xs font-mono w-12 text-right">
                      {yourCitationRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <Badge variant="outline" className="font-mono">
                    #{yourAverageRank?.toFixed(1) ?? "N/A"}
                  </Badge>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-sm font-medium">
                    {competitors.find(c => c.domain === yourDomain)?.citationCount ?? 3}
                  </span>
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* Show more button */}
        {competitors.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show Less" : `Show All ${competitors.length} Competitors`}
          </Button>
        )}

        {/* Bar chart visualization */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="text-sm font-medium text-muted-foreground">Citation Rate Comparison</h4>
          <div className="space-y-2">
            {displayCompetitors.slice(0, 5).map((competitor, idx) => {
              const isYou = competitor.domain.toLowerCase() === yourDomain.toLowerCase();
              const barWidth = (competitor.citationRate / maxCitationRate) * 100;
              
              return (
                <div key={competitor.domain} className="flex items-center gap-2">
                  <a
                    href={`https://${competitor.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs w-32 truncate text-right hover:text-blue-600 hover:underline"
                  >
                    {competitor.domain}
                  </a>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full flex items-center justify-end pr-2 text-xs font-medium text-white",
                        isYou ? "bg-primary" :
                        idx === 0 ? "bg-emerald-500" :
                        idx === 1 ? "bg-blue-500" :
                        idx === 2 ? "bg-purple-500" :
                        "bg-gray-500"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                    >
                      {competitor.citationRate >= 20 && `${competitor.citationRate.toFixed(0)}%`}
                    </motion.div>
                  </div>
                  {competitor.citationRate < 20 && (
                    <span className="text-xs text-muted-foreground w-10">
                      {competitor.citationRate.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
            {!isYouInList && (
              <div className="flex items-center gap-2">
                <span className="text-xs w-32 truncate text-right font-medium text-primary">
                  {yourDomain}
                </span>
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                  <motion.div
                    className="h-full flex items-center justify-end pr-2 text-xs font-medium text-white bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(yourCitationRate / maxCitationRate) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  >
                    {yourCitationRate >= 20 && `${yourCitationRate.toFixed(0)}%`}
                  </motion.div>
                </div>
                {yourCitationRate < 20 && (
                  <span className="text-xs text-muted-foreground w-10">
                    {yourCitationRate.toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

