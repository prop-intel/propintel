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
 * Make an API request with authentication
 * @param path API path
 * @param options Request options
 * @param sessionToken Optional session token for server-side calls (client-side uses cookies automatically)
 * @param cookie Optional cookie string for server-side calls (alternative to sessionToken)
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string | null,
  cookie?: string | null
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

  // Authentication: Prefer session token if provided (server-side), otherwise use API key or cookies
  if (sessionToken) {
    // Server-side: Use Bearer token
    headers.set("Authorization", `Bearer ${sessionToken}`);
  } else if (cookie && cookie.trim().length > 0) {
    // Server-side: Use cookie header (only if cookie is not empty)
    headers.set("Cookie", cookie);
  }
  
  // Always include API key as fallback if available (for server-side calls)
  if (process.env.NEXT_PUBLIC_API_KEY) {
    headers.set("X-Api-Key", process.env.NEXT_PUBLIC_API_KEY);
  }
  // Client-side: cookies are sent automatically with credentials: "include"

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Send session cookies (works for client-side)
  });

  // Handle HTTP errors first
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode = `HTTP_${response.status}`;
    let errorDetails: string | undefined;

    try {
      const errorData = (await response.json()) as ApiError | { error?: { message?: string; code?: string } };
      if (errorData && typeof errorData === 'object') {
        if ('error' in errorData && errorData.error) {
          errorCode = errorData.error.code || errorCode;
          errorMessage = errorData.error.message || errorMessage;
        } else if ('message' in errorData) {
          errorMessage = String(errorData.message);
        }
      }
    } catch {
      // If we can't parse the error, use the default
    }

    throw new ApiClientError(errorCode, errorMessage, errorDetails);
  }

  const data = (await response.json()) as ApiResponse<T> | ApiError;

  // Handle error responses
  if (!data.success) {
    const error = data as ApiError;
    throw new ApiClientError(
      error.error?.code || 'UNKNOWN_ERROR',
      error.error?.message || 'An unknown error occurred',
      error.error?.details
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
     * @param cookie Optional cookie string for server-side calls
     */
    create: async (
      request: CreateJobRequest,
      cookie?: string | null
    ): Promise<{ job: Job }> => {
      return apiRequest<{ job: Job }>(
        "/jobs",
        {
          method: "POST",
          body: JSON.stringify({
            targetUrl: request.targetUrl,
            config: request.config,
            competitors: request.competitors,
            webhookUrl: request.webhookUrl,
            llmModel: request.llmModel,
          }),
        },
        null,
        cookie
      );
    },

    /**
     * Get job status by ID
     * @param cookie Optional cookie string for server-side calls
     */
    get: async (id: string, cookie?: string | null): Promise<{ job: Job }> => {
      return apiRequest<{ job: Job }>(`/jobs/${id}`, {}, null, cookie);
    },

    /**
     * List jobs with pagination
     * @param cookie Optional cookie string for server-side calls
     */
    list: async (
      limit = 20,
      offset = 0,
      cookie?: string | null
    ): Promise<PaginatedResponse<Job>> => {
      const response = await apiRequest<{
        jobs: Job[];
        pagination: {
          limit: number;
          offset: number;
          hasMore: boolean;
        };
      }>(`/jobs?limit=${limit}&offset=${offset}`, {}, null, cookie);

      return {
        items: response.jobs,
        pagination: response.pagination,
      };
    },

    /**
     * Get analysis report for a completed job
     * @param id Job ID
     * @param format 'json' (default) or 'md' for markdown
     * @param cookie Optional cookie string for server-side calls
     */
    getReport: async (
      id: string,
      format: "json" | "md" = "json",
      cookie?: string | null
    ): Promise<Report | string> => {
      if (format === "md") {
        // For markdown, return as text
        const headers: HeadersInit = {};
        if (cookie) {
          headers.Cookie = cookie;
        } else if (
          process.env.NODE_ENV === "development" &&
          process.env.NEXT_PUBLIC_API_KEY
        ) {
          headers["X-Api-Key"] = process.env.NEXT_PUBLIC_API_KEY;
        }

        const response = await fetch(
          `${API_URL}/jobs/${id}/report?format=md`,
          {
            credentials: "include",
            headers,
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

      return apiRequest<Report>(`/jobs/${id}/report?format=json`, {}, null, cookie);
    },
  },

  /**
   * Dashboard API
   */
  dashboard: {
    /**
     * Get dashboard summary with overview, recent jobs, top domains, and alerts
     * @param cookie Optional cookie string for server-side calls
     */
    getSummary: async (cookie?: string | null): Promise<DashboardSummary> => {
      return apiRequest<DashboardSummary>("/dashboard/summary", {}, null, cookie);
    },

    /**
     * Get score trends over time
     * @param domain Optional domain filter
     * @param days Number of days to include (default: 30)
     * @param cookie Optional cookie string for server-side calls
     */
    getTrends: async (
      domain?: string,
      days = 30,
      cookie?: string | null
    ): Promise<ScoreTrends> => {
      const params = new URLSearchParams({
        days: days.toString(),
      });
      if (domain) {
        params.set("domain", domain);
      }
      return apiRequest<ScoreTrends>(`/dashboard/trends?${params}`, {}, null, cookie);
    },

    /**
     * Get all alerts
     * @param cookie Optional cookie string for server-side calls
     */
    getAlerts: async (cookie?: string | null): Promise<{ alerts: Alert[] }> => {
      return apiRequest<{ alerts: Alert[] }>("/alerts", {}, null, cookie);
    },
  },

  /**
   * Health check (no authentication required)
   */
  health: async (): Promise<{ status: string }> => {
    return apiRequest<{ status: string }>("/health");
  },
};
