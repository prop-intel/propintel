"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import { useSite } from "@/contexts/site-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Globe, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

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

interface FullSummary {
  scores?: SummaryScores;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  nextSteps?: string[];
  recommendations?: Recommendation[];
  fullReport?: Record<string, unknown>;
}

// Type guard to check if summary is a FullSummary object
function isFullSummary(summary: unknown): summary is FullSummary {
  return typeof summary === 'object' && summary !== null;
}

// Component to display the full summary
function SummaryDisplay({ summary }: { summary: FullSummary }) {
  return (
    <>
      {summary.scores && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Scores</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {summary.scores.aeoVisibilityScore !== undefined && (
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">AEO Visibility</div>
                <div className="text-lg font-bold">{summary.scores.aeoVisibilityScore}/100</div>
              </div>
            )}
            {summary.scores.llmeoScore !== undefined && (
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">LLMEO</div>
                <div className="text-lg font-bold">{summary.scores.llmeoScore}/100</div>
              </div>
            )}
            {summary.scores.seoScore !== undefined && (
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">SEO</div>
                <div className="text-lg font-bold">{summary.scores.seoScore}/100</div>
              </div>
            )}
            {summary.scores.overallScore !== undefined && (
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Overall</div>
                <div className="text-lg font-bold">{summary.scores.overallScore}/100</div>
              </div>
            )}
          </div>
        </div>
      )}

      {summary.strengths && summary.strengths.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Strengths</Label>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {summary.strengths.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.weaknesses && summary.weaknesses.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Weaknesses</Label>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {summary.weaknesses.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.opportunities && summary.opportunities.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Opportunities</Label>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {summary.opportunities.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.nextSteps && summary.nextSteps.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Next Steps</Label>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {summary.nextSteps.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.recommendations && summary.recommendations.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Recommendations</Label>
          <div className="space-y-2">
            {summary.recommendations.map((rec, idx) => (
              <div key={idx} className="border rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <h5 className="font-medium text-sm">{rec.title ?? `Recommendation ${idx + 1}`}</h5>
                  {rec.priority && (
                    <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "default" : "secondary"}>
                      {rec.priority}
                    </Badge>
                  )}
                </div>
                {rec.description && (
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.fullReport && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
            View Full Report (JSON)
          </summary>
          <div className="mt-2 rounded-md bg-muted p-4">
            <pre className="text-xs overflow-auto max-h-96">
              {JSON.stringify(summary.fullReport, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </>
  );
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
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Analysis Progress</CardTitle>
                  <CardDescription>
                    Analyzing: <span className="font-mono text-sm">{targetUrl || "N/A"}</span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {status && (
                    <div className="text-sm text-muted-foreground">
                      {getStatusBadge(status.status)}
                    </div>
                  )}
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
            </CardHeader>
            <CardContent className="space-y-4">
              {statusLoading && statusHistory.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : statusHistory.length > 0 ? (
                <div className="space-y-4">
                  {statusHistory.map((update, index) => {
                    const isLatest = index === statusHistory.length - 1;
                    const overallCompleted = status?.status === "completed";
                    const overallFailed = status?.status === "failed" || status?.status === "blocked";
                    
                    // Determine the effective status for this phase:
                    // - If overall job is completed, all phases should show completed
                    // - If overall job failed, previous phases completed before failure
                    // - Otherwise, use the phase's own status
                    const effectiveStatus = overallCompleted 
                      ? "completed" 
                      : overallFailed && !isLatest
                        ? "completed"
                        : update.status;
                    
                    const isInProgress = isLatest && (effectiveStatus === "crawling" || effectiveStatus === "analyzing");
                    const isCompleted = effectiveStatus === "completed";
                    const isFailed = effectiveStatus === "failed" || effectiveStatus === "blocked";
                    
                    return (
                    <div key={index} className={`border-l-2 pl-4 space-y-2 ${isCompleted ? "border-green-500" : isFailed ? "border-destructive" : isInProgress ? "border-primary" : "border-muted-foreground"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isInProgress ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : isFailed ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                          )}
                          <h4 className="font-semibold capitalize">{update.phase}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(effectiveStatus)}
                          <span className="text-xs text-muted-foreground">
                            {update.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      
                      {update.agentSummaries && Object.keys(update.agentSummaries).length > 0 && (
                        <div className="ml-6 space-y-2">
                          <Label className="text-xs text-muted-foreground">Agent Steps:</Label>
                          <div className="space-y-2">
                            {Object.entries(update.agentSummaries).map(([agentId, rawSummary]) => {
                              const agentSummary = rawSummary as AgentSummary;
                              return (
                              <div key={agentId} className="text-sm border rounded p-2 bg-muted/50">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    {agentSummary.status === "completed" ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : agentSummary.status === "failed" ? (
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    ) : agentSummary.status === "running" ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="font-medium">{agentId}</span>
                                  </div>
                                  {agentSummary.status && (
                                    <Badge
                                      variant={
                                        agentSummary.status === "completed"
                                          ? "default"
                                          : agentSummary.status === "failed"
                                          ? "destructive"
                                          : agentSummary.status === "running"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className={`text-xs ${agentSummary.status === "completed" ? "bg-green-500 hover:bg-green-600" : ""}`}
                                    >
                                      {agentSummary.status === "running" && (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      )}
                                      {agentSummary.status}
                                    </Badge>
                                  )}
                                </div>
                                {agentSummary.summary && (
                                  <p className="text-xs text-muted-foreground mb-2">{agentSummary.summary}</p>
                                )}
                                {agentSummary.keyFindings && agentSummary.keyFindings.length > 0 && (
                                  <div className="text-xs">
                                    <span className="font-medium">Findings: </span>
                                    <span className="text-muted-foreground">
                                      {agentSummary.keyFindings.join(", ")}
                                    </span>
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              ) : status ? (
                <Alert>
                  <AlertDescription>
                    Waiting for status updates...
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertDescription>
                    No status data available. Make sure the job ID is correct and the job exists.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Show full summary at the end when completed */}
          {status?.status === "completed" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Final Summary</CardTitle>
                    <CardDescription>Complete analysis summary</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchStatus()}
                    disabled={statusLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
                    Refresh Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isFullSummary(status.summary) ? (
                  <SummaryDisplay summary={status.summary} />
                ) : status.summary ? (
                  <div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                    {typeof status.summary === 'string' 
                      ? status.summary 
                      : JSON.stringify(status.summary, null, 2)}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Report is being generated. Click &quot;Refresh Report&quot; to check again.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Show execution plan if available */}
          {status?.executionPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Execution Plan</CardTitle>
                <CardDescription>Planned phases and agents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(status.executionPlan as ExecutionPlan).phases?.map((phase, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{phase.name ?? `Phase ${index + 1}`}</h4>
                        <Badge variant={phase.runInParallel ? "default" : "secondary"}>
                          {phase.runInParallel ? "Parallel" : "Sequential"}
                        </Badge>
                      </div>
                      {phase.agents && phase.agents.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {phase.agents.map((agentId: string, agentIndex: number) => (
                            <Badge key={agentIndex} variant="outline">
                              {agentId}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
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
