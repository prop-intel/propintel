/**
 * Shared TypeScript types used by both frontend and backend
 */

// Job Status - shared between frontend and backend
export type JobStatus =
  | "pending"
  | "queued"
  | "crawling"
  | "analyzing"
  | "completed"
  | "failed"
  | "blocked";

// Basic API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}
