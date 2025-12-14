/**
 * React hooks for job operations
 * Uses React Query for caching and state management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CreateJobRequest } from "@/lib/api/types";

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
