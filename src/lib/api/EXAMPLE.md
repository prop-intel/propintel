# Backend API Integration Examples

## Example 1: Create and Monitor a Job

```typescript
"use client";

import { useState } from "react";
import { useCreateJob, useJobQuery } from "@/hooks/use-jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export function JobCreator() {
  const [url, setUrl] = useState("");
  const createJob = useCreateJob();
  const { data: job, isLoading } = useJobQuery(createJob.data?.id ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createJob.mutateAsync({
      targetUrl: url,
      config: { maxPages: 50, maxDepth: 3 },
    });
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
        <Button type="submit" disabled={createJob.isPending}>
          {createJob.isPending ? "Creating..." : "Start Analysis"}
        </Button>
      </form>

      {job && (
        <div>
          <p>Status: {job.status}</p>
          {job.progress.pagesTotal > 0 && (
            <Progress
              value={(job.progress.pagesCrawled / job.progress.pagesTotal) * 100}
            />
          )}
          <p>{job.progress.currentPhase}</p>
        </div>
      )}

      {createJob.isError && (
        <p className="text-red-500">
          Error: {createJob.error?.message}
        </p>
      )}
    </div>
  );
}
```

## Example 2: Display Report Scores

```typescript
"use client";

import { useJobReport } from "@/hooks/use-jobs";
import type { Report } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportScores({ jobId }: { jobId: string }) {
  const { data: report, isLoading } = useJobReport(
    jobId,
    "json"
  ) as { data: Report | null; isLoading: boolean };

  if (isLoading) return <div>Loading report...</div>;
  if (!report) return <div>Report not available</div>;

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>AEO Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {report.scores.aeoVisibilityScore}
          </div>
          <p className="text-sm text-muted-foreground">
            Citation Rate: {report.aeoAnalysis.citationRate}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LLMEO Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {report.scores.llmeoScore}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {report.scores.seoScore}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overall Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {report.scores.overallScore}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Example 3: Dashboard Summary

```typescript
"use client";

import { useDashboardSummary, useAlerts } from "@/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DashboardOverview() {
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: alerts } = useAlerts();

  if (isLoading) return <div>Loading...</div>;
  if (!summary) return <div>No data</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.overview.totalJobs}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.overview.completedJobs}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.overview.averageScore}
            </div>
            <p className="text-sm text-muted-foreground">
              {summary.overview.scoreChange > 0 ? "+" : ""}
              {summary.overview.scoreChange} from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {summary.overview.failedJobs}
            </div>
          </CardContent>
        </Card>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Alerts</h2>
          {alerts.map((alert, idx) => (
            <Alert
              key={idx}
              variant={
                alert.severity === "critical"
                  ? "destructive"
                  : alert.severity === "warning"
                    ? "default"
                    : "default"
              }
            >
              <AlertTitle>{alert.type}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Example 4: Score Trends Chart

```typescript
"use client";

import { useScoreTrends } from "@/hooks/use-dashboard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function ScoreTrendsChart({ domain }: { domain?: string }) {
  const { data: trends, isLoading } = useScoreTrends(domain, 30);

  if (isLoading) return <div>Loading trends...</div>;
  if (!trends || trends.trends.length === 0) return <div>No data</div>;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={trends.trends}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="aeoScore"
          stroke="#8884d8"
          name="AEO Score"
        />
        <Line
          type="monotone"
          dataKey="llmeoScore"
          stroke="#82ca9d"
          name="LLMEO Score"
        />
        <Line
          type="monotone"
          dataKey="seoScore"
          stroke="#ffc658"
          name="SEO Score"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Example 5: Recommendations List

```typescript
"use client";

import { useJobReport } from "@/hooks/use-jobs";
import type { Report } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RecommendationsList({ jobId }: { jobId: string }) {
  const { data: report } = useJobReport(jobId, "json") as {
    data: Report | null;
  };

  if (!report) return null;

  const recommendations = [
    ...report.aeoRecommendations,
    ...report.recommendations,
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Recommendations</h2>
      {recommendations.map((rec) => (
        <Card key={rec.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{rec.title}</CardTitle>
              <div className="flex gap-2">
                <Badge variant={rec.priority === "high" ? "destructive" : "secondary"}>
                  {rec.priority}
                </Badge>
                <Badge variant="outline">{rec.effort}</Badge>
              </div>
            </div>
            <CardDescription>{rec.category}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>{rec.description}</p>
            {rec.impact && (
              <p className="mt-2 text-sm text-muted-foreground">
                Impact: {rec.impact}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```
