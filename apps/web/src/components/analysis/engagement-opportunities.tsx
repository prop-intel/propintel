"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ExternalLink,
  MessageCircle,
  HelpCircle,
  GitCompare,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Search,
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

export interface PlatformOpportunities {
  reddit: EngagementOpportunity[];
  twitter: EngagementOpportunity[];
  hackernews: EngagementOpportunity[];
  other: EngagementOpportunity[];
}

export interface QueryBreakdown {
  query: string;
  opportunitiesFound: number;
}

export interface EngagementOpportunitiesProps {
  opportunities: EngagementOpportunity[];
  platforms?: PlatformOpportunities;
  queryBreakdown?: QueryBreakdown[];
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
// Opportunity Item Component
// ===================

function OpportunityItem({
  opp,
  idx,
  expandedId,
  setExpandedId,
  idPrefix = "",
}: {
  opp: EngagementOpportunity;
  idx: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  idPrefix?: string;
}) {
  const TypeIcon = getOpportunityTypeIcon(opp.opportunityType);
  const uniqueId = `${idPrefix}${opp.url}-${idx}`;

  return (
    <motion.div
      key={uniqueId}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.03 }}
    >
      <Collapsible
        open={expandedId === uniqueId}
        onOpenChange={() =>
          setExpandedId(expandedId === uniqueId ? null : uniqueId)
        }
      >
        <div className="w-full p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all hover:shadow-md">
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

              {/* Title as clickable link */}
              <a
                href={opp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground hover:text-blue-600 hover:underline line-clamp-2 block"
                onClick={(e) => e.stopPropagation()}
              >
                {opp.title}
                <ExternalLink className="h-3 w-3 inline ml-1.5 opacity-50" />
              </a>

              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                Related to: &quot;{opp.query}&quot;
              </p>
            </div>

            {/* Expand icon */}
            <CollapsibleTrigger asChild>
              <button className="p-1 hover:bg-muted rounded-md transition-colors flex-shrink-0">
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    expandedId === uniqueId && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>
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
                <p className="text-sm text-primary">{opp.whyGoodOpportunity}</p>
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
}

// ===================
// Main Component
// ===================

export function EngagementOpportunities({
  opportunities,
  platforms,
  queryBreakdown,
  className,
}: EngagementOpportunitiesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("top");
  const [platformFilter, setPlatformFilter] = useState<"all" | "reddit" | "twitter" | "hackernews">("all");

  // Get counts from platforms prop or calculate from opportunities
  const redditCount = platforms?.reddit?.length ?? opportunities.filter((o) => o.platform === "reddit").length;
  const twitterCount = platforms?.twitter?.length ?? opportunities.filter((o) => o.platform === "twitter").length;
  const hnCount = platforms?.hackernews?.length ?? opportunities.filter((o) => o.platform === "hackernews").length;
  const totalCount = redditCount + twitterCount + hnCount + (platforms?.other?.length ?? 0);

  // Sort by relevance score
  const sortedOpportunities = [...opportunities].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  // Get platform-specific opportunities
  const getPlatformOpportunities = (platform: "reddit" | "twitter" | "hackernews") => {
    if (platforms?.[platform]) {
      return [...platforms[platform]].sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    return opportunities.filter((o) => o.platform === platform).sort((a, b) => b.relevanceScore - a.relevanceScore);
  };

  // Get filtered opportunities for "all" view
  const getFilteredOpportunities = () => {
    if (platformFilter === "all") {
      // Combine all platform opportunities if available
      if (platforms) {
        const all = [
          ...platforms.reddit,
          ...platforms.twitter,
          ...platforms.hackernews,
          ...platforms.other,
        ];
        return all.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
      return sortedOpportunities;
    }
    return getPlatformOpportunities(platformFilter);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Engagement Opportunities</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono">
            {totalCount} found
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Discussions where you could add value by participating
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform breakdown - clickable to filter */}
        <div className="grid grid-cols-3 gap-4">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              setActiveTab("platforms");
              setPlatformFilter("reddit");
            }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg bg-[#FF4500]/10 border border-[#FF4500]/30 transition-all hover:bg-[#FF4500]/20",
              platformFilter === "reddit" && activeTab === "platforms" && "ring-2 ring-[#FF4500]"
            )}
          >
            <PlatformIcon platform="reddit" className="h-6 w-6" />
            <div className="text-left">
              <div className="text-2xl font-bold text-[#FF4500]">{redditCount}</div>
              <div className="text-xs text-muted-foreground">Reddit</div>
            </div>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => {
              setActiveTab("platforms");
              setPlatformFilter("twitter");
            }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 transition-all hover:bg-black/10 dark:hover:bg-white/20",
              platformFilter === "twitter" && activeTab === "platforms" && "ring-2 ring-foreground"
            )}
          >
            <PlatformIcon platform="twitter" className="h-5 w-5" />
            <div className="text-left">
              <div className="text-2xl font-bold">{twitterCount}</div>
              <div className="text-xs text-muted-foreground">X (Twitter)</div>
            </div>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => {
              setActiveTab("platforms");
              setPlatformFilter("hackernews");
            }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg bg-[#FF6600]/10 border border-[#FF6600]/30 transition-all hover:bg-[#FF6600]/20",
              platformFilter === "hackernews" && activeTab === "platforms" && "ring-2 ring-[#FF6600]"
            )}
          >
            <PlatformIcon platform="hackernews" className="h-5 w-5" />
            <div className="text-left">
              <div className="text-2xl font-bold text-[#FF6600]">{hnCount}</div>
              <div className="text-xs text-muted-foreground">Hacker News</div>
            </div>
          </motion.button>
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="top">Top Opportunities</TabsTrigger>
            <TabsTrigger value="platforms">By Platform</TabsTrigger>
            <TabsTrigger value="queries" disabled={!queryBreakdown?.length}>
              By Query
            </TabsTrigger>
          </TabsList>

          {/* Top Opportunities Tab */}
          <TabsContent value="top" className="mt-4 space-y-3">
            {sortedOpportunities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No engagement opportunities found yet.</p>
                <p className="text-sm mt-1">Run an analysis to discover discussions.</p>
              </div>
            ) : (
              <>
                {sortedOpportunities.slice(0, 15).map((opp, idx) => (
                  <OpportunityItem
                    key={`top-${opp.url}-${idx}`}
                    opp={opp}
                    idx={idx}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    idPrefix="top-"
                  />
                ))}
                {sortedOpportunities.length > 15 && (
                  <div className="text-center text-sm text-muted-foreground pt-2">
                    Showing top 15 of {sortedOpportunities.length} opportunities
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* By Platform Tab */}
          <TabsContent value="platforms" className="mt-4 space-y-4">
            {/* Platform filter buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setPlatformFilter("all")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md border transition-colors",
                  platformFilter === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                )}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setPlatformFilter("reddit")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1.5",
                  platformFilter === "reddit"
                    ? "bg-[#FF4500] text-white border-[#FF4500]"
                    : "hover:bg-muted"
                )}
              >
                <PlatformIcon platform="reddit" className="h-4 w-4" />
                Reddit ({redditCount})
              </button>
              <button
                onClick={() => setPlatformFilter("twitter")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1.5",
                  platformFilter === "twitter"
                    ? "bg-foreground text-background border-foreground"
                    : "hover:bg-muted"
                )}
              >
                <PlatformIcon platform="twitter" className="h-3.5 w-3.5" />
                X ({twitterCount})
              </button>
              <button
                onClick={() => setPlatformFilter("hackernews")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1.5",
                  platformFilter === "hackernews"
                    ? "bg-[#FF6600] text-white border-[#FF6600]"
                    : "hover:bg-muted"
                )}
              >
                <PlatformIcon platform="hackernews" className="h-4 w-4" />
                HN ({hnCount})
              </button>
            </div>

            {/* Filtered opportunities list */}
            <div className="space-y-3">
              {getFilteredOpportunities().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No opportunities found for this platform.</p>
                </div>
              ) : (
                getFilteredOpportunities().slice(0, 25).map((opp, idx) => (
                  <OpportunityItem
                    key={`platform-${opp.url}-${idx}`}
                    opp={opp}
                    idx={idx}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    idPrefix="platform-"
                  />
                ))
              )}
              {getFilteredOpportunities().length > 25 && (
                <div className="text-center text-sm text-muted-foreground pt-2">
                  Showing 25 of {getFilteredOpportunities().length} opportunities
                </div>
              )}
            </div>
          </TabsContent>

          {/* By Query Tab */}
          <TabsContent value="queries" className="mt-4 space-y-4">
            {queryBreakdown && queryBreakdown.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  See which search queries found the most engagement opportunities
                </p>
                {queryBreakdown.map((item, idx) => (
                  <motion.div
                    key={item.query}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium">&quot;{item.query}&quot;</span>
                    </div>
                    <Badge variant={item.opportunitiesFound > 5 ? "default" : "secondary"}>
                      {item.opportunitiesFound} {item.opportunitiesFound === 1 ? "opportunity" : "opportunities"}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No query breakdown available.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
