"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "@/trpc/react";
import { useSite } from "@/contexts/site-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Globe, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
} from "@/components/analysis";
import type { AgentStatus, PipelinePhase } from "@/components/analysis";

interface AgentSummary {
  status?: string;
  summary?: string;
  keyFindings?: string[];
}

interface SummaryScores {
  aeoVisibilityScore?: number;
  llmeoScore?: number;
  seoScore?: number;
  overallScore?: number;
}

interface AEOAnalysis {
  visibilityScore?: number;
  queriesAnalyzed?: number;
  citationCount?: number;
  citationRate?: number;
  pageAnalysis?: {
    topic?: string;
    intent?: string;
    entities?: string[];
    contentType?: string;
    summary?: string;
    keyPoints?: string[];
  };
  targetQueries?: Array<{
    query: string;
    type: string;
    relevanceScore: number;
  }>;
  citations?: Array<{
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
  }>;
  competitors?: Array<{
    domain: string;
    citationCount: number;
    citationRate: number;
    averageRank: number;
    topQueries?: string[];
    strengths?: string[];
  }>;
  gaps?: Array<{
    query: string;
    yourPosition: string;
    winningDomain: string;
    winningUrl: string;
    winningReason?: string;
    suggestedAction?: string;
  }>;
  keyFindings?: string[];
  topPerformingQueries?: string[];
  missedOpportunities?: string[];
}

interface FullSummary {
  scores?: SummaryScores;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  nextSteps?: string[];
  recommendations?: Recommendation[];
  fullReport?: {
    aeoAnalysis?: AEOAnalysis;
    meta?: {
      domain?: string;
    };
    scores?: {
      confidence?: number;
    };
    [key: string]: unknown;
  };
}

// Type guard to check if summary is a FullSummary object
function isFullSummary(summary: unknown): summary is FullSummary {
  return typeof summary === 'object' && summary !== null;
}

interface Recommendation {
  title?: string;
  priority?: "high" | "medium" | "low";
  description?: string;
}

interface ExecutionPhase {
  name?: string;
  runInParallel?: boolean;
  agents?: string[];
}

interface ExecutionPlan {
  phases?: ExecutionPhase[];
}

interface StatusUpdate {
  phase: string;
  status: string;
  timestamp: Date;
  summary?: unknown;
  agentSummaries?: Record<string, unknown>;
}

export default function AgentAnalysisPage() {
  const { activeSite, isLoading: siteLoading } = useSite();
  const [jobId, setJobId] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusUpdate[]>([]);
  const previousStatusRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState("pipeline");

  // Compute the target URL from the active site
  const targetUrl = activeSite ? `https://${activeSite.domain}` : "";

  const createJobMutation = api.job.create.useMutation({
    onSuccess: (job) => {
      setJobId(job.id);
      // Reset history when starting a new job
      setStatusHistory([]);
      previousStatusRef.current = null;
    },
  });

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = api.orchestrator.getStatus.useQuery(
    { jobId: jobId ?? "" },
    { 
      enabled: !!jobId,
      refetchInterval: (query) => {
        // Poll every 2 seconds if job is running or completed but no summary yet
        const data = query.state.data;
        if (data) {
          if (data.status === "crawling" || data.status === "analyzing") {
            return 2000;
          }
          // Keep polling if completed but no summary yet
          if (data.status === "completed" && !data.summary) {
            return 2000;
          }
        }
        return false;
      },
    }
  );

  // Track status history
  useEffect(() => {
    if (!status) return;

    const currentStatusKey = `${status.status}-${status.currentPhase}`;
    
    // Only add new entry if status or phase changed
    if (previousStatusRef.current !== currentStatusKey) {
      const newUpdate: StatusUpdate = {
        phase: status.currentPhase || status.status,
        status: status.status,
        timestamp: new Date(),
        summary: status.summary ?? undefined,
        agentSummaries: status.agentSummaries ?? undefined,
      };

      setStatusHistory((prev) => {
        // Check if we already have this exact status (avoid duplicates)
        const lastUpdate = prev[prev.length - 1];
        if (lastUpdate && lastUpdate.phase === newUpdate.phase && lastUpdate.status === newUpdate.status) {
          // Update the existing entry instead of adding duplicate
          return prev.map((update, idx) => 
            idx === prev.length - 1 ? { ...update, ...newUpdate } : update
          );
        }
        return [...prev, newUpdate];
      });

      previousStatusRef.current = currentStatusKey;
    } else {
      // Update the latest entry with new data (like summary or agent summaries)
      setStatusHistory((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        const lastItem = updated[lastIndex];
        if (!lastItem) return prev;
        updated[lastIndex] = {
          ...lastItem,
          summary: status.summary ?? lastItem.summary,
          agentSummaries: status.agentSummaries ?? lastItem.agentSummaries,
        };
        return updated;
      });
    }
  }, [status]);

  // Convert status to pipeline phases
  const pipelinePhases = useMemo((): PipelinePhase[] => {
    if (!status?.agentSummaries) return [];

    const agentSummaries = status.agentSummaries as Record<string, AgentSummary>;
    
    // Group agents by phase
    const phases: PipelinePhase[] = [];
    const seenAgents = new Set<string>();

    // Define phase categories
    const phaseGroups = [
      { name: "Discovery", pattern: /page|query|competitor|discovery/i },
      { name: "Research", pattern: /tavily|research|google|perplexity|community/i },
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
            name: agentId.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            status: summary?.status === "completed" ? "completed" :
                   summary?.status === "running" ? "running" :
                   summary?.status === "failed" ? "failed" : "pending",
            summary: summary?.summary,
            keyFindings: summary?.keyFindings,
          });
        }
      }

      if (agents.length > 0) {
        const phaseStatus = agents.every(a => a.status === "completed") ? "completed" :
                          agents.some(a => a.status === "running") ? "running" :
                          agents.some(a => a.status === "failed") ? "failed" : "pending";
        
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
          name: agentId.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          status: summary?.status === "completed" ? "completed" :
                 summary?.status === "running" ? "running" :
                 summary?.status === "failed" ? "failed" : "pending",
          summary: summary?.summary,
          keyFindings: summary?.keyFindings,
        });
      }
    }

    if (remainingAgents.length > 0) {
      phases.push({
        name: "Processing",
        status: remainingAgents.every(a => a.status === "completed") ? "completed" :
               remainingAgents.some(a => a.status === "running") ? "running" :
               remainingAgents.some(a => a.status === "failed") ? "failed" : "pending",
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
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Pending", spinning: false, className: "" },
      crawling: { variant: "default" as const, icon: Loader2, label: "Crawling", spinning: true, className: "" },
      analyzing: { variant: "default" as const, icon: Loader2, label: "Analyzing", spinning: true, className: "" },
      completed: { variant: "default" as const, icon: CheckCircle2, label: "Completed", spinning: false, className: "bg-green-500 hover:bg-green-600" },
      failed: { variant: "destructive" as const, icon: XCircle, label: "Failed", spinning: false, className: "" },
      blocked: { variant: "destructive" as const, icon: XCircle, label: "Blocked", spinning: false, className: "" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className={`h-3 w-3 ${config.spinning ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  // Extract report data
  const fullReport = isFullSummary(status?.summary) ? status.summary.fullReport : null;
  const aeoAnalysis = fullReport?.aeoAnalysis;
  const scores = isFullSummary(status?.summary) ? status.summary.scores : null;
  const domain = fullReport?.meta?.domain ?? activeSite?.domain ?? "";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Analysis</h1>
        <p className="text-muted-foreground">
          Analyze how AI agents see your site and get recommendations to improve visibility
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start Analysis</CardTitle>
          <CardDescription>Analyze your site with the orchestrator agent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {siteLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner />
            </div>
          ) : !activeSite ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No site selected. Please add or select a site from the sidebar to analyze.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Target URL</Label>
                <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{targetUrl}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleStartAnalysis}
                  disabled={createJobMutation.isPending || !!jobId}
                >
                  {createJobMutation.isPending ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Analysis
                    </>
                  )}
                </Button>
              </div>
              {createJobMutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {createJobMutation.error.message || "Failed to create analysis job"}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {jobId && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="results" disabled={status?.status !== "completed"}>
                Results
              </TabsTrigger>
              <TabsTrigger value="details" disabled={status?.status !== "completed"}>
                Details
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              {status && getStatusBadge(status.status)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
                disabled={statusLoading}
              >
                <RefreshCw className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Pipeline Tab - Shows during analysis */}
          <TabsContent value="pipeline" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analysis Progress</CardTitle>
                    <CardDescription>
                      Analyzing: <span className="font-mono text-sm">{targetUrl || "N/A"}</span>
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
                strengths={isFullSummary(status?.summary) ? status.summary.strengths : undefined}
                weaknesses={isFullSummary(status?.summary) ? status.summary.weaknesses : undefined}
                opportunities={isFullSummary(status?.summary) ? status.summary.opportunities : undefined}
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
                yourAverageRank={
                  aeoAnalysis.citations
                    ?.filter(c => c.yourRank)
                    .reduce((sum, c, _, arr) => sum + (c.yourRank ?? 0) / arr.length, 0)
                }
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
                  <CardDescription>Raw analysis data for debugging</CardDescription>
                </CardHeader>
                <CardContent>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      Click to expand
                    </summary>
                    <div className="mt-4 rounded-md bg-muted p-4">
                      <pre className="text-xs overflow-auto max-h-96">
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

      {!jobId && !createJobMutation.isPending && activeSite && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Click &quot;Start Analysis&quot; to analyze your site
          </CardContent>
        </Card>
      )}
    </div>
  );
}
