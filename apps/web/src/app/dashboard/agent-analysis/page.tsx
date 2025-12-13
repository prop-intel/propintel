"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "@/trpc/react";
import { useSite } from "@/contexts/site-context";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

// Import analysis components
import {
  AgentPipeline,
  ScoreDashboard,
  PageAnalysisCard,
  QueryPerformance,
  CitationChart,
  CompetitorLandscape,
  ContentGaps,
  KeyFindings,
  EngagementOpportunities,
} from "@/components/analysis";
import type { AgentStatus, PipelinePhase } from "@/components/analysis";
import type { AgentSummary } from "@/types/agent-analysis";
import { isFullSummary } from "@/types/agent-analysis";

export default function AgentAnalysisPage() {
  const { activeSite, isLoading: siteLoading } = useSite();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState("pipeline");
  const utils = api.useUtils();

  // Fetch jobs for the active site using tRPC (shares cache with mutations)
  const {
    data: jobsData,
    isLoading: jobsLoading,
  } = api.job.list.useQuery(
    { limit: 50, offset: 0, siteId: activeSite?.id },
    { enabled: !!activeSite?.id }
  );

  const jobs = useMemo(() => jobsData?.items ?? [], [jobsData?.items]);

  // Auto-select most recent job on load
  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0]!.id);
    }
  }, [jobs, selectedJobId]);

  // Reset selection when site changes
  useEffect(() => {
    setSelectedJobId(null);
    previousStatusRef.current = null;
  }, [activeSite?.id]);

  const createJobMutation = api.job.create.useMutation({
    onSuccess: (job) => {
      setSelectedJobId(job.id);
      previousStatusRef.current = null;
      void utils.job.list.invalidate();
    },
  });

  const {
    data: status,
    isLoading: statusLoading,
  } = api.orchestrator.getStatus.useQuery(
    { jobId: selectedJobId ?? "" },
    {
      enabled: !!selectedJobId,
      refetchInterval: (query) => {
        // Poll every 3 seconds if job is running or completed but no summary yet
        const data = query.state.data;
        if (data) {
          if (data.status === "crawling" || data.status === "analyzing") {
            return 3000;
          }
          // Keep polling if completed but no summary yet
          if (data.status === "completed" && !data.summary) {
            return 3000;
          }
        }
        return false;
      },
    },
  );

  // Track status changes
  useEffect(() => {
    if (!status) return;
    const currentStatusKey = `${status.status}-${status.currentPhase}`;
    previousStatusRef.current = currentStatusKey;
  }, [status]);

  // Convert status to pipeline phases
  const pipelinePhases = useMemo((): PipelinePhase[] => {
    if (!status?.agentSummaries) return [];

    const agentSummaries = status.agentSummaries as Record<
      string,
      AgentSummary
    >;

    // Group agents by phase
    const phases: PipelinePhase[] = [];
    const seenAgents = new Set<string>();

    // Define phase categories
    const phaseGroups = [
      { name: "Discovery", pattern: /page|query|competitor|discovery/i },
      {
        name: "Research",
        pattern: /tavily|research|google|perplexity|community/i,
      },
      { name: "Analysis", pattern: /citation|content|visibility|analysis/i },
      { name: "Output", pattern: /recommendation|cursor|prompt|output/i },
    ];

    for (const group of phaseGroups) {
      const agents: AgentStatus[] = [];

      for (const [agentId, summary] of Object.entries(agentSummaries)) {
        if (seenAgents.has(agentId)) continue;
        if (group.pattern.test(agentId)) {
          seenAgents.add(agentId);
          agents.push({
            id: agentId,
            name: agentId
              .replace(/-/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase()),
            status:
              summary?.status === "completed"
                ? "completed"
                : summary?.status === "running"
                  ? "running"
                  : summary?.status === "failed"
                    ? "failed"
                    : "pending",
            summary: summary?.summary,
            keyFindings: summary?.keyFindings,
          });
        }
      }

      if (agents.length > 0) {
        const phaseStatus = agents.every((a) => a.status === "completed")
          ? "completed"
          : agents.some((a) => a.status === "running")
            ? "running"
            : agents.some((a) => a.status === "failed")
              ? "failed"
              : "pending";

        phases.push({
          name: group.name,
          status: phaseStatus,
          agents,
          parallel: group.name === "Research" || group.name === "Analysis",
        });
      }
    }

    // Add any remaining agents to a general phase
    const remainingAgents: AgentStatus[] = [];
    for (const [agentId, summary] of Object.entries(agentSummaries)) {
      if (!seenAgents.has(agentId)) {
        remainingAgents.push({
          id: agentId,
          name: agentId
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          status:
            summary?.status === "completed"
              ? "completed"
              : summary?.status === "running"
                ? "running"
                : summary?.status === "failed"
                  ? "failed"
                  : "pending",
          summary: summary?.summary,
          keyFindings: summary?.keyFindings,
        });
      }
    }

    if (remainingAgents.length > 0) {
      phases.push({
        name: "Processing",
        status: remainingAgents.every((a) => a.status === "completed")
          ? "completed"
          : remainingAgents.some((a) => a.status === "running")
            ? "running"
            : remainingAgents.some((a) => a.status === "failed")
              ? "failed"
              : "pending",
        agents: remainingAgents,
        parallel: false,
      });
    }

    return phases;
  }, [status?.agentSummaries]);

  const handleStartAnalysis = () => {
    if (!activeSite) {
      return;
    }

    createJobMutation.mutate({
      targetUrl: `https://${activeSite.domain}`,
      siteId: activeSite.id,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        variant: "secondary" as const,
        icon: Clock,
        label: "Pending",
        spinning: false,
        className: "",
      },
      crawling: {
        variant: "default" as const,
        icon: Loader2,
        label: "Crawling",
        spinning: true,
        className: "",
      },
      analyzing: {
        variant: "default" as const,
        icon: Loader2,
        label: "Analyzing",
        spinning: true,
        className: "",
      },
      completed: {
        variant: "default" as const,
        icon: CheckCircle2,
        label: "Completed",
        spinning: false,
        className: "bg-green-500 hover:bg-green-600",
      },
      failed: {
        variant: "destructive" as const,
        icon: XCircle,
        label: "Failed",
        spinning: false,
        className: "",
      },
      blocked: {
        variant: "destructive" as const,
        icon: XCircle,
        label: "Blocked",
        spinning: false,
        className: "",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className={`h-3 w-3 ${config.spinning ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  // Helper to get status icon for dropdown
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

  // Extract report data
  const fullReport = isFullSummary(status?.summary)
    ? status?.summary.fullReport
    : null;
  const aeoAnalysis = fullReport?.aeoAnalysis;
  const scores = isFullSummary(status?.summary) ? status?.summary.scores : null;
  const domain = fullReport?.meta?.domain ?? activeSite?.domain ?? "";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Analysis</h1>
        <p className="text-muted-foreground">
          Analyze how AI agents see your site and get recommendations to improve
          visibility
        </p>
      </div>

      {siteLoading ? (
        <div className="flex items-center justify-center py-4">
          <Spinner />
        </div>
      ) : !activeSite ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No site selected. Please add or select a site from the sidebar to
            analyze.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <span className="text-muted-foreground whitespace-nowrap text-sm">
                Analysis:
              </span>
              <Select
                value={selectedJobId ?? undefined}
                onValueChange={(value) => {
                  setSelectedJobId(value);
                  previousStatusRef.current = null;
                }}
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
                          {format(new Date(job.createdAt), "MMM d, yyyy h:mm a")}
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
                  Start New Analysis
                </>
              )}
            </Button>
          </div>

          {createJobMutation.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {createJobMutation.error.message ||
                  "Failed to create analysis job"}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {selectedJobId && (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger
                value="results"
                disabled={status?.status !== "completed"}
              >
                Results
              </TabsTrigger>
              <TabsTrigger
                value="details"
                disabled={status?.status !== "completed"}
              >
                Details
              </TabsTrigger>
            </TabsList>
            {status && getStatusBadge(status.status)}
          </div>

          {/* Pipeline Tab - Shows during analysis */}
          <TabsContent value="pipeline" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analysis Progress</CardTitle>
                    <CardDescription>
                      Analyzing:{" "}
                      <span className="font-mono text-sm">
                        {activeSite?.domain ?? "N/A"}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {statusLoading && pipelinePhases.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner />
                  </div>
                ) : pipelinePhases.length > 0 ? (
                  <AgentPipeline
                    phases={pipelinePhases}
                    currentPhase={status?.currentPhase ?? undefined}
                  />
                ) : (
                  <Alert>
                    <AlertDescription>
                      Waiting for analysis to start...
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab - Shows after completion */}
          <TabsContent value="results" className="space-y-6">
            {scores && (
              <Card>
                <CardContent className="pt-6">
                  <ScoreDashboard
                    scores={scores}
                    confidence={fullReport?.scores?.confidence ?? 0.6}
                  />
                </CardContent>
              </Card>
            )}

            {aeoAnalysis?.keyFindings && (
              <KeyFindings
                findings={aeoAnalysis.keyFindings}
                strengths={
                  isFullSummary(status?.summary)
                    ? status?.summary.strengths
                    : undefined
                }
                weaknesses={
                  isFullSummary(status?.summary)
                    ? status?.summary.weaknesses
                    : undefined
                }
                opportunities={
                  isFullSummary(status?.summary)
                    ? status?.summary.opportunities
                    : undefined
                }
              />
            )}

            {/* Community Engagement Opportunities */}
            {aeoAnalysis?.communityEngagement?.topOpportunities &&
              aeoAnalysis.communityEngagement.topOpportunities.length > 0 && (
                <EngagementOpportunities
                  opportunities={aeoAnalysis.communityEngagement.topOpportunities}
                />
              )}

            {aeoAnalysis?.citations && aeoAnalysis.citations.length > 0 && (
              <CitationChart
                citations={aeoAnalysis.citations}
                visibilityScore={aeoAnalysis.visibilityScore ?? 0}
                queriesAnalyzed={aeoAnalysis.queriesAnalyzed ?? 0}
                citationRate={aeoAnalysis.citationRate ?? 0}
              />
            )}

            {aeoAnalysis?.competitors && aeoAnalysis.competitors.length > 0 && (
              <CompetitorLandscape
                competitors={aeoAnalysis.competitors}
                yourDomain={domain}
                yourCitationRate={aeoAnalysis.citationRate ?? 0}
                yourAverageRank={aeoAnalysis.citations
                  ?.filter((c) => c.yourRank)
                  .reduce(
                    (sum, c, _, arr) => sum + (c.yourRank ?? 0) / arr.length,
                    0,
                  )}
              />
            )}
          </TabsContent>

          {/* Details Tab - Detailed breakdown */}
          <TabsContent value="details" className="space-y-6">
            {aeoAnalysis?.pageAnalysis && (
              <PageAnalysisCard analysis={aeoAnalysis.pageAnalysis} />
            )}

            {aeoAnalysis?.targetQueries && aeoAnalysis.citations && (
              <QueryPerformance
                targetQueries={aeoAnalysis.targetQueries}
                citations={aeoAnalysis.citations}
              />
            )}

            {aeoAnalysis?.gaps && aeoAnalysis.gaps.length > 0 && (
              <ContentGaps
                gaps={aeoAnalysis.gaps}
                missedOpportunities={aeoAnalysis.missedOpportunities}
                topPerformingQueries={aeoAnalysis.topPerformingQueries}
              />
            )}

            {/* Full JSON report */}
            {fullReport && (
              <Card>
                <CardHeader>
                  <CardTitle>Full Report (JSON)</CardTitle>
                  <CardDescription>
                    Raw analysis data for debugging
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <details>
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
                      Click to expand
                    </summary>
                    <div className="bg-muted mt-4 rounded-md p-4">
                      <pre className="max-h-96 overflow-auto text-xs">
                        {JSON.stringify(fullReport, null, 2)}
                      </pre>
                    </div>
                  </details>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

    </div>
  );
}
