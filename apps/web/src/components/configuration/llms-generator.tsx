"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/trpc/react";
import {
  RefreshCw,
  Download,
  Copy,
  Check,
  Sparkles,
  Globe,
  FileText,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type LlmsFileType = "llms.txt" | "llms-full.txt";

interface LlmsGeneratorProps {
  siteId: string;
  siteName: string;
  domain: string;
  existingLlmsTxtContent: string | null;
  existingLlmsTxtFound: boolean;
  existingLlmsTxtError: string | null;
  existingLlmsFullTxtContent: string | null;
  existingLlmsFullTxtFound: boolean;
  existingLlmsFullTxtError: string | null;
  existingLoading: boolean;
  onRefreshExisting: () => void;
}

interface GeneratedData {
  llmsTxt: string;
  llmsFullTxt: string;
  jobId: string;
  jobDate: Date;
  pageCount: number;
}

interface GeneratedContentProps {
  data: GeneratedData;
  formatJobDate: (date: Date) => string;
  handleDownload: (content: string, filename: string) => void;
  handleCopy: (content: string) => Promise<void>;
  copied: boolean;
  selectedFileType: LlmsFileType;
  onFileTypeChange: (fileType: LlmsFileType) => void;
}

function GeneratedContent({
  data,
  formatJobDate,
  handleDownload,
  handleCopy,
  copied,
  selectedFileType,
  onFileTypeChange,
}: GeneratedContentProps) {
  const displayContent = selectedFileType === "llms.txt" ? data.llmsTxt : data.llmsFullTxt;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{data.pageCount} pages</Badge>
          <span className="text-sm text-muted-foreground">
            Generated from analysis on {formatJobDate(data.jobDate)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">File:</label>
        <Select
          value={selectedFileType}
          onValueChange={(value) => onFileTypeChange(value as LlmsFileType)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="llms.txt">llms.txt</SelectItem>
            <SelectItem value="llms-full.txt">llms-full.txt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-80 overflow-y-auto">
        <code>{displayContent}</code>
      </pre>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => handleDownload(data.llmsTxt, "llms.txt")}
        >
          <Download className="h-4 w-4 mr-2" />
          Download llms.txt
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload(data.llmsFullTxt, "llms-full.txt")}
        >
          <Download className="h-4 w-4 mr-2" />
          Download llms-full.txt
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleCopy(displayContent)}
        >
          {copied ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function LlmsGenerator({
  siteId,
  siteName: _siteName,
  domain,
  existingLlmsTxtContent,
  existingLlmsTxtFound,
  existingLlmsTxtError,
  existingLlmsFullTxtContent,
  existingLlmsFullTxtFound,
  existingLlmsFullTxtError,
  existingLoading,
  onRefreshExisting,
}: LlmsGeneratorProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(
    null
  );
  const [existingFileType, setExistingFileType] = useState<LlmsFileType>("llms.txt");
  const [generatedFileType, setGeneratedFileType] = useState<LlmsFileType>("llms.txt");

  // Fetch completed jobs for the dropdown
  const jobsQuery = api.llmsTxt.getCompletedJobs.useQuery(
    { siteId },
    { enabled: !!siteId }
  );

  // Generate mutation
  const generateMutation = api.llmsTxt.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedData(data);
    },
  });

  const jobs = jobsQuery.data ?? [];

  // Set default job when jobs load
  useEffect(() => {
    if (jobsQuery.data && jobsQuery.data.length > 0 && !selectedJobId) {
      setSelectedJobId(jobsQuery.data[0]?.id);
    }
  }, [jobsQuery.data, selectedJobId]);

  // Clear generated data when job changes
  useEffect(() => {
    setGeneratedData(null);
  }, [selectedJobId]);

  const handleGenerate = useCallback(() => {
    if (selectedJobId) {
      generateMutation.mutate({ siteId, jobId: selectedJobId });
    }
  }, [siteId, selectedJobId, generateMutation]);

  const handleCopy = useCallback(async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDownload = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const formatJobDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              llms.txt
            </CardTitle>
            <CardDescription>
              AI-specific instructions file (emerging standard)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="existing" className="gap-2">
              <Globe className="h-4 w-4" />
              Your llms files
            </TabsTrigger>
            <TabsTrigger value="generate" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate from Analysis
            </TabsTrigger>
          </TabsList>

          {/* Existing llms.txt Tab */}
          <TabsContent value="existing">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">File:</label>
                  <Select
                    value={existingFileType}
                    onValueChange={(value) => setExistingFileType(value as LlmsFileType)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llms.txt">llms.txt</SelectItem>
                      <SelectItem value="llms-full.txt">llms-full.txt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefreshExisting}
                  disabled={existingLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${existingLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>

              {(() => {
                const content = existingFileType === "llms.txt" ? existingLlmsTxtContent : existingLlmsFullTxtContent;
                const found = existingFileType === "llms.txt" ? existingLlmsTxtFound : existingLlmsFullTxtFound;
                const error = existingFileType === "llms.txt" ? existingLlmsTxtError : existingLlmsFullTxtError;

                if (existingLoading) {
                  return <Skeleton className="h-48 w-full" />;
                }
                if (!found) {
                  return (
                    <Alert>
                      <AlertTitle>No {existingFileType} found</AlertTitle>
                      <AlertDescription>
                        {error ??
                          `No ${existingFileType} file found at https://${domain}/${existingFileType}. You can generate one from your analysis data using the "Generate from Analysis" tab.`}
                      </AlertDescription>
                    </Alert>
                  );
                }
                return (
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                    <code>{content}</code>
                  </pre>
                );
              })()}
            </div>
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate">
            <div className="space-y-4">
              {/* Job Selector */}
              {jobsQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : jobs.length === 0 ? (
                <Alert>
                  <AlertTitle>No completed analysis</AlertTitle>
                  <AlertDescription>
                    Run an analysis on your site first to generate an llms.txt
                    file. Go to the Analyze page to start a new analysis.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium whitespace-nowrap">
                      Analysis:
                    </label>
                    <Select
                      value={selectedJobId}
                      onValueChange={setSelectedJobId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select an analysis" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {formatJobDate(job.createdAt)}
                            {job.pageCount > 0 && ` - ${job.pageCount} pages`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleGenerate}
                      disabled={!selectedJobId || generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      Generate
                    </Button>
                  </div>

                  {/* Generated Content Preview */}
                  {generateMutation.isPending ? (
                    <Skeleton className="h-48 w-full" />
                  ) : generateMutation.error ? (
                    <Alert variant="destructive">
                      <AlertTitle>Generation failed</AlertTitle>
                      <AlertDescription>
                        {generateMutation.error.message}
                      </AlertDescription>
                    </Alert>
                  ) : generatedData ? (
                    <GeneratedContent
                      data={generatedData}
                      formatJobDate={formatJobDate}
                      handleDownload={handleDownload}
                      handleCopy={handleCopy}
                      copied={copied}
                      selectedFileType={generatedFileType}
                      onFileTypeChange={setGeneratedFileType}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Select an analysis and click Generate to create your
                      llms.txt and llms-full.txt files.
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
