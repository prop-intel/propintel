/**
 * PropIntel Backend API Client
 * Main entry point for backend API integration
 */

export * from "./client";
export * from "./types";
export { api } from "./client";
export type {
  Job,
  JobStatus,
  Report,
  Scores,
  Recommendation,
  DashboardSummary,
  ScoreTrends,
  Alert,
  CreateJobRequest,
  ApiResponse,
  ApiError,
  PaginatedResponse,
} from "./types";
