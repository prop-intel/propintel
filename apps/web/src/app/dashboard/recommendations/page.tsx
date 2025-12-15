"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/trpc/react";
import { useSite } from "@/contexts/site-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Lightbulb,
  Zap,
  MessageCircle,
  Terminal,
} from "lucide-react";
import { format } from "date-fns";

// Import analysis components
import {
  RecommendationsCard,
  CursorPromptCard,
  EngagementOpportunities,
} from "@/components/analysis";
import type { AEORecommendation, CursorPrompt, CommunityEngagement } from "@/types/agent-analysis";

export default function RecommendationsPage() {
  const { activeSite, isLoading: siteLoading } = useSite();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const utils = api.useUtils();

  // Fetch jobs for the active site
  const { data: jobsData, isLoading: jobsLoading } = api.job.list.useQuery(
    { limit: 50, offset: 0, siteId: activeSite?.id },
    { enabled: !!activeSite?.id }
  );

  const jobs = useMemo(() => jobsData?.items ?? [], [jobsData?.items]);

  // Auto-select most recent completed job when there's no selection
  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      // Find the most recent completed job
      const completedJob = jobs.find((j) => j.status === "completed");
      if (completedJob) {
        setSelectedJobId(completedJob.id);
      } else if (jobs[0]) {
        // Fallback to most recent job if none completed
        setSelectedJobId(jobs[0].id);
      }
    }
  }, [jobs, selectedJobId]);

  // Reset selection when site changes
  useEffect(() => {
    setSelectedJobId(null);
  }, [activeSite?.id]);

  const createJobMutation = api.job.create.useMutation({
    onSuccess: (job) => {
      setSelectedJobId(job.id);
      void utils.job.list.invalidate();
    },
  });

  const { data: status, isLoading: statusLoading } =
    api.orchestrator.getStatus.useQuery(
      { jobId: selectedJobId ?? "" },
      {
        enabled: !!selectedJobId,
        refetchInterval: (query) => {
          const data = query.state.data;
          if (data) {
            if (data.status === "crawling" || data.status === "analyzing") {
              return 3000;
            }
            if (data.status === "completed" && !data.summary) {
              return 3000;
            }
          }
          return false;
        },
      }
    );

  const handleStartAnalysis = () => {
    if (!activeSite) return;
    createJobMutation.mutate({
      targetUrl: `https://${activeSite.domain}`,
      siteId: activeSite.id,
    });
  };

  const getStatusIcon = (jobStatus: string) => {
    switch (jobStatus) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
      case "blocked":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "crawling":
      case "analyzing":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (
    jobStatus: string
  ): "default" | "secondary" | "destructive" => {
    switch (jobStatus) {
      case "completed":
        return "default";
      case "failed":
      case "blocked":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Extract report data - handle different data structures
  const summary = status?.summary as Record<string, unknown> | undefined;
  const fullReport = summary?.fullReport as Record<string, unknown> | undefined;
  const aeoAnalysis = fullReport?.aeoAnalysis as Record<string, unknown> | undefined;
  
  // Get recommendations from multiple possible locations
  const aeoRecommendations: AEORecommendation[] = (
    fullReport?.aeoRecommendations ?? 
    summary?.recommendations ?? 
    []
  ) as AEORecommendation[];
  
  const cursorPrompt = fullReport?.cursorPrompt as CursorPrompt | undefined;
  const communityEngagement = aeoAnalysis?.communityEngagement as CommunityEngagement | undefined;

  // Filter recommendations by type
  const quickWins = aeoRecommendations.filter((r) => r.effort === "low");

  // Check if we have any data to display
  const hasRecommendations = aeoRecommendations.length > 0;
  const hasCursorPrompt = !!cursorPrompt?.prompt;
  const hasEngagement = !!communityEngagement?.topOpportunities?.length;
  
  const isAnalysisReady = status?.status === "completed" && (hasRecommendations || hasCursorPrompt || hasEngagement || fullReport);

  return (
    <div className="space-y-6 p-6">
      {/* Header with Analysis Selector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recommendations</h1>
          <p className="text-muted-foreground">
            Actionable steps to improve your AI search visibility
          </p>
        </div>
        {activeSite && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={selectedJobId ?? undefined}
              onValueChange={setSelectedJobId}
            >
              <SelectTrigger className="w-full sm:w-[340px]">
                <SelectValue
                  placeholder={
                    jobsLoading ? "Loading..." : "Select an analysis"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    <div className="flex items-center gap-2 w-full">
                      {getStatusIcon(job.status)}
                      <span className="flex-1">
                        {format(
                          new Date(job.createdAt),
                          "MMM d, yyyy h:mm a"
                        )}
                      </span>
                      <Badge
                        variant={getStatusVariant(job.status)}
                        className="text-xs"
                      >
                        {job.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
                {jobs.length === 0 && !jobsLoading && (
                  <div className="text-muted-foreground px-2 py-1.5 text-sm">
                    No analyses yet
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleStartAnalysis}
              disabled={
                createJobMutation.isPending ||
                status?.status === "crawling" ||
                status?.status === "analyzing"
              }
            >
              {createJobMutation.isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  New Analysis
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {siteLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !activeSite ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No site selected. Please add or select a site from the sidebar.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Analysis in progress */}
          {(status?.status === "crawling" ||
            status?.status === "analyzing") && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">
                      Analysis in progress...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This typically takes 2-3 minutes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading state */}
          {((statusLoading && selectedJobId) || jobsLoading) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Spinner className="h-8 w-8 mx-auto mb-4" />
                <p className="text-muted-foreground">Loading recommendations...</p>
              </CardContent>
            </Card>
          )}

          {/* Tabs - only show when analysis is ready */}
          {!statusLoading && !jobsLoading && isAnalysisReady && (
            <Tabs defaultValue="quick-wins" className="space-y-6">
              <TabsList>
                <TabsTrigger value="quick-wins" className="gap-2">
                  Quick Wins
                  {quickWins.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-green-500/10 text-green-600 border-green-500/30"
                    >
                      {quickWins.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="content">Content Actions</TabsTrigger>
                <TabsTrigger value="engagement">Engagement</TabsTrigger>
                <TabsTrigger value="cursor-prompts">Cursor Prompts</TabsTrigger>
              </TabsList>

              {/* Quick Wins Tab */}
              <TabsContent value="quick-wins" className="space-y-6">
                {quickWins.length > 0 ? (
                  <>
                    {/* Hero card for top quick win */}
                    <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-green-500/10">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-green-500" />
                          <CardTitle>Top Quick Win</CardTitle>
                        </div>
                        <CardDescription>
                          Highest impact, lowest effort recommendation
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold">
                              {quickWins[0]?.title}
                            </h3>
                            <p className="text-muted-foreground mt-1">
                              {quickWins[0]?.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge
                              variant="outline"
                              className="bg-green-500/10 text-green-600 border-green-500/30"
                            >
                              {quickWins[0]?.impact}
                            </Badge>
                            <Badge variant="secondary">
                              {quickWins[0]?.category}
                            </Badge>
                          </div>
                          {cursorPrompt?.prompt && (
                            <Button
                              onClick={() => {
                                void navigator.clipboard.writeText(
                                  cursorPrompt.prompt
                                );
                              }}
                              className="gap-2"
                            >
                              <Terminal className="h-4 w-4" />
                              Copy Cursor Prompt
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Remaining quick wins */}
                    {quickWins.length > 1 && (
                      <RecommendationsCard
                        recommendations={quickWins.slice(1)}
                      />
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No quick wins identified. Check Content Actions for more
                        recommendations.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Content Actions Tab */}
              <TabsContent value="content" className="space-y-6">
                {aeoRecommendations.length > 0 ? (
                  <RecommendationsCard recommendations={aeoRecommendations} />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No content recommendations available.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Engagement Tab */}
              <TabsContent value="engagement" className="space-y-6">
                {communityEngagement ? (
                  <EngagementOpportunities
                    opportunities={communityEngagement.topOpportunities ?? []}
                    platforms={communityEngagement.platforms}
                    queryBreakdown={communityEngagement.queryBreakdown}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No engagement opportunities found yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Cursor Prompts Tab */}
              <TabsContent value="cursor-prompts" className="space-y-6">
                {cursorPrompt?.prompt ? (
                  <CursorPromptCard cursorPrompt={cursorPrompt} />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Terminal className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No Cursor prompts generated yet.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Complete an analysis to get ready-to-use Cursor prompts.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Empty state when no analysis - only show when not loading */}
          {!statusLoading && !jobsLoading && !isAnalysisReady && (
            <Card>
              <CardContent className="py-12 text-center">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  No Recommendations Yet
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  {jobs.length === 0
                    ? "Start your first analysis to get personalized recommendations."
                    : "Select a completed analysis to view recommendations, or start a new analysis."}
                </p>
                {jobs.length === 0 && (
                  <Button onClick={handleStartAnalysis}>
                    <Play className="mr-2 h-4 w-4" />
                    Start First Analysis
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

