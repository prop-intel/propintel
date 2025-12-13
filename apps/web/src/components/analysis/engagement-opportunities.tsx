"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  MessageCircle,
  HelpCircle,
  GitCompare,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Image from "next/image";

// ===================
// Types
// ===================

export interface EngagementOpportunity {
  platform: "reddit" | "twitter" | "hackernews" | "other";
  url: string;
  title: string;
  snippet: string;
  query: string;
  relevanceScore: number;
  opportunityType:
    | "question"
    | "recommendation-request"
    | "comparison"
    | "discussion"
    | "complaint";
  foundAt: string;
  // Optional LLM-generated summary of why this is a good opportunity
  whyGoodOpportunity?: string;
}

export interface EngagementOpportunitiesProps {
  opportunities: EngagementOpportunity[];
  className?: string;
}

// ===================
// Platform Icons
// ===================

function PlatformIcon({
  platform,
  className,
}: {
  platform: EngagementOpportunity["platform"];
  className?: string;
}) {
  switch (platform) {
    case "reddit":
      return (
        <Image
          src="/icons/reddit-icon.svg"
          alt="Reddit"
          width={20}
          height={20}
          className={cn("rounded-sm", className)}
        />
      );
    case "twitter":
      return (
        <Image
          src="/icons/x.svg"
          alt="X (Twitter)"
          width={16}
          height={16}
          className={cn("dark:invert", className)}
        />
      );
    case "hackernews":
      return (
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-sm bg-[#FF6600] text-[10px] font-bold text-white",
            className
          )}
        >
          Y
        </span>
      );
    default:
      return <MessageCircle className={cn("h-5 w-5", className)} />;
  }
}

// ===================
// Opportunity Type Helpers
// ===================

function getOpportunityTypeIcon(type: EngagementOpportunity["opportunityType"]) {
  switch (type) {
    case "question":
      return HelpCircle;
    case "recommendation-request":
      return Sparkles;
    case "comparison":
      return GitCompare;
    case "discussion":
      return MessageSquare;
    case "complaint":
      return AlertCircle;
    default:
      return MessageCircle;
  }
}

function getOpportunityTypeLabel(type: EngagementOpportunity["opportunityType"]) {
  switch (type) {
    case "question":
      return "Question";
    case "recommendation-request":
      return "Seeking Recommendations";
    case "comparison":
      return "Comparison";
    case "discussion":
      return "Discussion";
    case "complaint":
      return "Pain Point";
    default:
      return "Other";
  }
}

function getOpportunityTypeColor(type: EngagementOpportunity["opportunityType"]) {
  switch (type) {
    case "question":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "recommendation-request":
      return "bg-purple-500/10 text-purple-600 border-purple-500/30";
    case "comparison":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "discussion":
      return "bg-gray-500/10 text-gray-600 border-gray-500/30";
    case "complaint":
      return "bg-red-500/10 text-red-600 border-red-500/30";
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/30";
  }
}

function getPlatformName(platform: EngagementOpportunity["platform"]) {
  switch (platform) {
    case "reddit":
      return "Reddit";
    case "twitter":
      return "X";
    case "hackernews":
      return "Hacker News";
    default:
      return "Web";
  }
}

// ===================
// Main Component
// ===================

export function EngagementOpportunities({
  opportunities,
  className,
}: EngagementOpportunitiesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group by platform for stats
  const redditCount = opportunities.filter((o) => o.platform === "reddit").length;
  const twitterCount = opportunities.filter((o) => o.platform === "twitter").length;
  const hnCount = opportunities.filter((o) => o.platform === "hackernews").length;

  // Sort by relevance score
  const sortedOpportunities = [...opportunities].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Engagement Opportunities</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono">
            {opportunities.length} found
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Discussions where you could add value by participating
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-[#FF4500]/10 border border-[#FF4500]/30"
          >
            <PlatformIcon platform="reddit" className="h-6 w-6" />
            <div>
              <div className="text-2xl font-bold text-[#FF4500]">{redditCount}</div>
              <div className="text-xs text-muted-foreground">Reddit</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20"
          >
            <PlatformIcon platform="twitter" className="h-5 w-5" />
            <div>
              <div className="text-2xl font-bold">{twitterCount}</div>
              <div className="text-xs text-muted-foreground">X (Twitter)</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-[#FF6600]/10 border border-[#FF6600]/30"
          >
            <PlatformIcon platform="hackernews" className="h-5 w-5" />
            <div>
              <div className="text-2xl font-bold text-[#FF6600]">{hnCount}</div>
              <div className="text-xs text-muted-foreground">Hacker News</div>
            </div>
          </motion.div>
        </div>

        {/* Opportunities list */}
        {sortedOpportunities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No engagement opportunities found yet.</p>
            <p className="text-sm mt-1">Run an analysis to discover discussions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedOpportunities.slice(0, 15).map((opp, idx) => {
              const TypeIcon = getOpportunityTypeIcon(opp.opportunityType);
              const uniqueId = `${opp.url}-${idx}`;

              return (
                <motion.div
                  key={uniqueId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Collapsible
                    open={expandedId === uniqueId}
                    onOpenChange={() =>
                      setExpandedId(expandedId === uniqueId ? null : uniqueId)
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <div className="w-full p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all hover:shadow-md">
                        <div className="flex items-start gap-3">
                          {/* Platform icon */}
                          <div className="flex-shrink-0 mt-1">
                            <PlatformIcon platform={opp.platform} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  getOpportunityTypeColor(opp.opportunityType)
                                )}
                              >
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {getOpportunityTypeLabel(opp.opportunityType)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {getPlatformName(opp.platform)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                • {opp.relevanceScore}% match
                              </span>
                            </div>
                            <p className="text-sm font-medium text-foreground line-clamp-2">
                              {opp.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              Related to: &quot;{opp.query}&quot;
                            </p>
                          </div>

                          {/* Expand icon */}
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform flex-shrink-0",
                              expandedId === uniqueId && "rotate-180"
                            )}
                          />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-2 ml-8 p-4 rounded-lg bg-muted/50 space-y-3"
                      >
                        {/* Snippet */}
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-medium">
                            Preview
                          </div>
                          <p className="text-sm">{opp.snippet}</p>
                        </div>

                        {/* Why this is a good opportunity */}
                        {opp.whyGoodOpportunity && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                              <Sparkles className="h-3 w-3" />
                              <span>Why engage?</span>
                            </div>
                            <p className="text-sm text-primary">
                              {opp.whyGoodOpportunity}
                            </p>
                          </div>
                        )}

                        {/* Link */}
                        <a
                          href={opp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                        >
                          <PlatformIcon platform={opp.platform} className="h-4 w-4" />
                          Open on {getPlatformName(opp.platform)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </motion.div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Show more indicator */}
        {sortedOpportunities.length > 15 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing top 15 of {sortedOpportunities.length} opportunities
          </div>
        )}
      </CardContent>
    </Card>
  );
}
