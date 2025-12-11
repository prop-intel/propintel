/**
 * API-related types for request/response handling
 */

/**
 * Standard API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Request metadata
 */
export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

/**
 * Generic API response wrapper
 * @typeParam T - The type of data returned on success
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/**
 * Paginated response wrapper
 * @typeParam T - The type of items in the list
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
