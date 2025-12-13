/**
 * React hook for managing multiple jobs
 * Uses React Query for caching and state management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Job, CreateJobRequest, PaginatedResponse } from "@/lib/api/types";

/**
 * Hook to fetch a single job
 */
export function useJobQuery(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const response = await api.jobs.get(jobId);
      return response.job;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data as Job | null;
      if (!job) return false;

      // Stop polling if job is in terminal state
      const terminalStatuses: Job["status"][] = [
        "completed",
        "failed",
        "blocked",
      ];
      if (terminalStatuses.includes(job.status)) {
        return false;
      }

      // Poll every 3 seconds for active jobs
      return 3000;
    },
  });
}

/**
 * Hook to list jobs with pagination
 */
export function useJobsQuery(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ["jobs", limit, offset],
    queryFn: async (): Promise<PaginatedResponse<Job>> => {
      return api.jobs.list(limit, offset);
    },
  });
}

/**
 * Hook to list jobs for a specific site with pagination
 */
export function useJobsBySiteQuery(siteId: string | null, limit = 20, offset = 0) {
  return useQuery({
    queryKey: ["jobs", "site", siteId, limit, offset],
    queryFn: async (): Promise<PaginatedResponse<Job>> => {
      if (!siteId) {
        return { items: [], pagination: { limit, offset, hasMore: false } };
      }
      return api.jobs.list(limit, offset, null, siteId);
    },
    enabled: !!siteId,
  });
}

/**
 * Hook to create a new job
 */
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateJobRequest) => {
      const response = await api.jobs.create(request);
      return response.job;
    },
    onSuccess: (newJob) => {
      // Invalidate jobs list to refetch
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      // Add the new job to cache
      queryClient.setQueryData(["job", newJob.id], newJob);
    },
    onError: (error: Error) => {
      console.error("Failed to create job:", error);
    },
  });
}

/**
 * Hook to get job report
 */
export function useJobReport(jobId: string | null, format: "json" | "md" = "json") {
  return useQuery({
    queryKey: ["job-report", jobId, format],
    queryFn: async () => {
      if (!jobId) return null;
      return api.jobs.getReport(jobId, format);
    },
    enabled: !!jobId,
    // Only fetch if job is completed
    staleTime: Infinity, // Reports don't change once generated
  });
}
