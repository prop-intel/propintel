/**
 * React hook for polling job status
 * Automatically polls until job reaches a terminal state
 */

import { useState, useEffect, useCallback } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import type { Job } from "@/lib/api/types";

interface UseJobOptions {
  /**
   * Polling interval in milliseconds (default: 3000)
   */
  interval?: number;
  /**
   * Whether to start polling immediately (default: true)
   */
  enabled?: boolean;
  /**
   * Callback when job reaches terminal state
   */
  onComplete?: (job: Job) => void;
  /**
   * Callback when job fails
   */
  onError?: (error: Error) => void;
}

const TERMINAL_STATUSES: Job["status"][] = [
  "completed",
  "failed",
  "blocked",
];

function isTerminalStatus(status: Job["status"]): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function useJob(
  jobId: string | null,
  options: UseJobOptions = {}
) {
  const {
    interval = 3000,
    enabled = true,
    onComplete,
    onError,
  } = options;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.jobs.get(jobId);
      const fetchedJob = response.job;

      setJob(fetchedJob);

      // If job is in terminal state, stop polling
      if (isTerminalStatus(fetchedJob.status)) {
        setLoading(false);
        onComplete?.(fetchedJob);
        return false; // Stop polling
      }

      return true; // Continue polling
    } catch (err) {
      const error =
        err instanceof ApiClientError
          ? err
          : new Error(err instanceof Error ? err.message : "Unknown error");
      setError(error);
      setLoading(false);
      onError?.(error);
      return false; // Stop polling on error
    }
  }, [jobId, onComplete, onError]);

  useEffect(() => {
    if (!jobId || !enabled) {
      setJob(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Initial fetch
    fetchJob();

    // Set up polling interval
    const pollInterval = setInterval(async () => {
      const shouldContinue = await fetchJob();
      if (!shouldContinue) {
        clearInterval(pollInterval);
      }
    }, interval);

    return () => {
      clearInterval(pollInterval);
    };
  }, [jobId, enabled, interval, fetchJob]);

  return {
    job,
    loading,
    error,
    isTerminal: job ? isTerminalStatus(job.status) : false,
    refetch: fetchJob,
  };
}
