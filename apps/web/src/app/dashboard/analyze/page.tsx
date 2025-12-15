"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/trpc/react";
import { useSite } from "@/contexts/site-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

// Import analysis components
import {
  ScoreDashboard,
  CitationChart,
  CompetitorLandscape,
  ContentGaps,
  KeyFindings,
  AnalysisProgressSteps,
} from "@/components/analysis";

export default function AnalyzePage() {
  const { activeSite, isLoading: siteLoading } = useSite();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [analysisJustStarted, setAnalysisJustStarted] = useState(false);
  const utils = api.useUtils();

  // Fetch jobs for the active site
  const { data: jobsData, isLoading: jobsLoading } = api.job.list.useQuery(
    { limit: 50, offset: 0, siteId: activeSite?.id },
    { enabled: !!activeSite?.id }
  );

  const jobs = useMemo(() => jobsData?.items ?? [], [jobsData?.items]);

  // Auto-select most recent completed job when jobs load
  useEffect(() => {
    if (jobs.length > 0 && !hasAutoSelected) {
      // Find the most recent completed job
      const completedJob = jobs.find((j) => j.status === "completed");
      if (completedJob) {
        setSelectedJobId(completedJob.id);
        setHasAutoSelected(true);
      } else if (jobs[0]) {
        // Fallback to most recent job if none completed
        setSelectedJobId(jobs[0].id);
        setHasAutoSelected(true);
      }
    }
  }, [jobs, hasAutoSelected]);

  // Reset selection when site changes
  useEffect(() => {
    setSelectedJobId(null);
    setHasAutoSelected(false);
  }, [activeSite?.id]);

  const createJobMutation = api.job.create.useMutation({
    onSuccess: (job) => {
      setSelectedJobId(job.id);
      setAnalysisJustStarted(true);
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

  // Reset analysisJustStarted when analysis completes or fails
  useEffect(() => {
    if (status?.status === "completed" || status?.status === "failed") {
      setAnalysisJustStarted(false);
    }
  }, [status?.status]);

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
  
  // Try to get scores from multiple possible locations
  const scores = (summary?.scores ?? fullReport?.scores ?? {
    aeoVisibilityScore: aeoAnalysis?.visibilityScore,
    overallScore: aeoAnalysis?.visibilityScore,
  }) as Record<string, number | undefined>;
  
  const domain = (fullReport?.meta as Record<string, unknown>)?.domain as string ?? activeSite?.domain ?? "";

  // Check if we have any meaningful data to display
  const hasScores = scores && (scores.aeoVisibilityScore !== undefined || scores.overallScore !== undefined);
  const hasAeoData = aeoAnalysis && (
    (aeoAnalysis.citations as unknown[])?.length > 0 || 
    (aeoAnalysis.keyFindings as unknown[])?.length > 0 ||
    (aeoAnalysis.competitors as unknown[])?.length > 0
  );
  const isAnalysisReady = status?.status === "completed" && (hasScores || hasAeoData || fullReport);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analyze</h1>
          <p className="text-muted-foreground">
            Understand how AI search engines see your content
          </p>
        </div>
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
          {/* Analysis selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <span className="text-muted-foreground whitespace-nowrap text-sm">
                    Analysis:
                  </span>
                  <Select
                    value={selectedJobId ?? undefined}
                    onValueChange={setSelectedJobId}
                  >
                    <SelectTrigger className="w-full max-w-[320px]">
                      <SelectValue
                        placeholder={
                          jobsLoading ? "Loading..." : "Select an analysis"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            <span>
                              {format(
                                new Date(job.createdAt),
                                "MMM d, yyyy h:mm a"
                              )}
                            </span>
                            <Badge
                              variant={getStatusVariant(job.status)}
                              className="ml-1 text-xs"
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
                </div>

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

            </CardContent>
          </Card>

          {/* Analysis Progress Steps - show when running or failed */}
          {(status?.status === "crawling" ||
            status?.status === "analyzing" ||
            status?.status === "failed" ||
            status?.status === "blocked" ||
            analysisJustStarted) && (
            <AnalysisProgressSteps
              executionPlan={status?.executionPlan as { phases: { name: string; agents: string[]; runInParallel: boolean }[]; estimatedDuration: number; reasoning: string } | null}
              agentSummaries={status?.agentSummaries as Record<string, { agentId: string; status: "pending" | "running" | "completed" | "failed"; summary?: string; duration?: number }> | undefined}
              currentPhase={status?.currentPhase}
              status={status?.status}
            />
          )}

          {/* Loading state */}
          {statusLoading && selectedJobId && (
            <Card>
              <CardContent className="py-12 text-center">
                <Spinner className="h-8 w-8 mx-auto mb-4" />
                <p className="text-muted-foreground">Loading analysis results...</p>
              </CardContent>
            </Card>
          )}

          {/* Tabs - only show when analysis is ready */}
          {!statusLoading && isAnalysisReady ? (
            <Tabs defaultValue="visibility" className="space-y-6">
              <TabsList>
                <TabsTrigger value="visibility">AI Visibility Score</TabsTrigger>
                <TabsTrigger value="competitor">Competitor Intel</TabsTrigger>
                <TabsTrigger value="gaps">Content Gaps</TabsTrigger>
              </TabsList>

              {/* AI Visibility Score Tab */}
              <TabsContent value="visibility" className="space-y-6">
                {hasScores && (
                  <Card>
                    <CardContent className="pt-6">
                      <ScoreDashboard
                        scores={scores as { aeoVisibilityScore?: number; llmeoScore?: number; seoScore?: number; overallScore?: number }}
                        confidence={(fullReport?.scores as Record<string, number>)?.confidence ?? 0.6}
                      />
                    </CardContent>
                  </Card>
                )}

                {(aeoAnalysis?.keyFindings as string[])?.length > 0 && (
                  <KeyFindings
                    findings={aeoAnalysis?.keyFindings as string[]}
                    strengths={summary?.strengths as string[] | undefined}
                    weaknesses={summary?.weaknesses as string[] | undefined}
                    opportunities={summary?.opportunities as string[] | undefined}
                  />
                )}

                {(aeoAnalysis?.citations as unknown[])?.length > 0 && (
                  <CitationChart
                    citations={aeoAnalysis?.citations as { query: string; yourPosition: "cited" | "mentioned" | "absent"; yourRank?: number; topResults?: { domain: string; url: string; rank: number }[]; winningDomain?: string; winningReason?: string }[]}
                    visibilityScore={(aeoAnalysis?.visibilityScore as number) ?? 0}
                    queriesAnalyzed={(aeoAnalysis?.queriesAnalyzed as number) ?? 0}
                    citationRate={(aeoAnalysis?.citationRate as number) ?? 0}
                  />
                )}
              </TabsContent>

              {/* Competitor Intel Tab */}
              <TabsContent value="competitor" className="space-y-6">
                {(aeoAnalysis?.competitors as unknown[])?.length > 0 ? (
                  <CompetitorLandscape
                    competitors={aeoAnalysis?.competitors as { domain: string; citationCount: number; citationRate: number; averageRank: number; topQueries?: string[]; strengths?: string[] }[]}
                    yourDomain={domain}
                    yourCitationRate={(aeoAnalysis?.citationRate as number) ?? 0}
                    yourAverageRank={(aeoAnalysis?.citations as { yourRank?: number }[])
                      ?.filter((c) => c.yourRank)
                      .reduce(
                        (sum, c, _, arr) => sum + (c.yourRank ?? 0) / arr.length,
                        0
                      )}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No competitor data available yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Content Gaps Tab */}
              <TabsContent value="gaps" className="space-y-6">
                {(aeoAnalysis?.gaps as unknown[])?.length > 0 ? (
                  <ContentGaps
                    gaps={aeoAnalysis?.gaps as { query: string; yourPosition: string; winningDomain: string; winningUrl: string; winningReason?: string; suggestedAction?: string }[]}
                    missedOpportunities={aeoAnalysis?.missedOpportunities as string[] | undefined}
                    topPerformingQueries={aeoAnalysis?.topPerformingQueries as string[] | undefined}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No content gaps identified yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : !statusLoading && !analysisJustStarted && status?.status !== "crawling" && status?.status !== "analyzing" && status?.status !== "failed" && status?.status !== "blocked" ? (
            /* Empty state when no analysis - hide when analysis is running or just started */
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Analysis Results</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  {jobs.length === 0
                    ? "Start your first analysis to see how AI search engines perceive your content."
                    : status?.status === "completed" && !fullReport
                    ? "Analysis completed but report data is still loading. Please wait..."
                    : "Select a completed analysis to view results, or start a new analysis."}
                </p>
                {jobs.length === 0 && (
                  <Button onClick={handleStartAnalysis}>
                    <Play className="mr-2 h-4 w-4" />
                    Start First Analysis
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

