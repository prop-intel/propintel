/**
 * PropIntel Backend API Client
 * Handles authentication and API requests to the backend service
 */

import type {
  ApiResponse,
  ApiError,
  Job,
  Report,
  DashboardSummary,
  ScoreTrends,
  Alert,
  CreateJobRequest,
  PaginatedResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.warn(
    "NEXT_PUBLIC_API_URL is not set. Backend API calls will fail."
  );
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Get the session token from cookies
 * In Next.js, we need to get this from the server side or use cookies()
 */
async function getSessionToken(): Promise<string | null> {
  // For client-side: cookies are sent automatically with credentials: 'include'
  // For server-side: we need to get from request headers/cookies
  if (typeof window === "undefined") {
    // Server-side: session token should be passed explicitly
    return null;
  }
  // Client-side: cookies are sent automatically
  return null;
}

/**
 * Make an API request with authentication
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_URL) {
    throw new ApiClientError(
      "MISSING_CONFIG",
      "NEXT_PUBLIC_API_URL is not configured"
    );
  }

  const url = `${API_URL}${path}`;
  const headers = new Headers(options.headers);

  // Set content type if body is provided
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // For development, allow API key authentication
  if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_API_KEY) {
    headers.set("X-Api-Key", process.env.NEXT_PUBLIC_API_KEY);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Send session cookies
  });

  const data = (await response.json()) as ApiResponse<T> | ApiError;

  // Handle error responses
  if (!data.success) {
    const error = data as ApiError;
    throw new ApiClientError(
      error.error.code,
      error.error.message,
      error.error.details
    );
  }

  // Handle HTTP errors
  if (!response.ok) {
    throw new ApiClientError(
      `HTTP_${response.status}`,
      `Request failed with status ${response.status}`,
      response.statusText
    );
  }

  return (data as ApiResponse<T>).data;
}

/**
 * PropIntel API Client
 */
export const api = {
  /**
   * Jobs API
   */
  jobs: {
    /**
     * Create a new analysis job
     */
    create: async (
      request: CreateJobRequest
    ): Promise<{ job: Job }> => {
      return apiRequest<{ job: Job }>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          targetUrl: request.targetUrl,
          config: request.config,
          competitors: request.competitors,
          webhookUrl: request.webhookUrl,
          llmModel: request.llmModel,
        }),
      });
    },

    /**
     * Get job status by ID
     */
    get: async (id: string): Promise<{ job: Job }> => {
      return apiRequest<{ job: Job }>(`/jobs/${id}`);
    },

    /**
     * List jobs with pagination
     */
    list: async (
      limit = 20,
      offset = 0
    ): Promise<PaginatedResponse<Job>> => {
      const response = await apiRequest<{
        jobs: Job[];
        pagination: {
          limit: number;
          offset: number;
          hasMore: boolean;
        };
      }>(`/jobs?limit=${limit}&offset=${offset}`);

      return {
        items: response.jobs,
        pagination: response.pagination,
      };
    },

    /**
     * Get analysis report for a completed job
     * @param id Job ID
     * @param format 'json' (default) or 'md' for markdown
     */
    getReport: async (
      id: string,
      format: "json" | "md" = "json"
    ): Promise<Report | string> => {
      if (format === "md") {
        // For markdown, return as text
        const response = await fetch(
          `${API_URL}/jobs/${id}/report?format=md`,
          {
            credentials: "include",
            headers: {
              ...(process.env.NODE_ENV === "development" &&
              process.env.NEXT_PUBLIC_API_KEY
                ? { "X-Api-Key": process.env.NEXT_PUBLIC_API_KEY }
                : {}),
            },
          }
        );

        if (!response.ok) {
          const error = (await response.json()) as ApiError;
          throw new ApiClientError(
            error.error.code,
            error.error.message,
            error.error.details
          );
        }

        return response.text();
      }

      return apiRequest<Report>(`/jobs/${id}/report?format=json`);
    },
  },

  /**
   * Dashboard API
   */
  dashboard: {
    /**
     * Get dashboard summary with overview, recent jobs, top domains, and alerts
     */
    getSummary: async (): Promise<DashboardSummary> => {
      return apiRequest<DashboardSummary>("/dashboard/summary");
    },

    /**
     * Get score trends over time
     * @param domain Optional domain filter
     * @param days Number of days to include (default: 30)
     */
    getTrends: async (
      domain?: string,
      days = 30
    ): Promise<ScoreTrends> => {
      const params = new URLSearchParams({
        days: days.toString(),
      });
      if (domain) {
        params.set("domain", domain);
      }
      return apiRequest<ScoreTrends>(`/dashboard/trends?${params}`);
    },

    /**
     * Get all alerts
     */
    getAlerts: async (): Promise<{ alerts: Alert[] }> => {
      return apiRequest<{ alerts: Alert[] }>("/alerts");
    },
  },

  /**
   * Health check (no authentication required)
   */
  health: async (): Promise<{ status: string }> => {
    return apiRequest<{ status: string }>("/health");
  },
};
