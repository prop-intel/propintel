/**
 * Job-related types shared between frontend and backend
 */

/**
 * Possible states of a job in the system
 */
export type JobStatus =
  | "pending"
  | "queued"
  | "crawling"
  | "analyzing"
  | "completed"
  | "failed"
  | "blocked";

/**
 * Job priority levels
 */
export type JobPriority = "low" | "normal" | "high";
