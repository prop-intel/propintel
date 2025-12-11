/**
 * React hooks for dashboard data
 * Uses React Query for caching and state management
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  ScoreTrends,
  Alert,
} from "@/lib/api/types";

/**
 * Hook to fetch dashboard summary
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      return api.dashboard.getSummary();
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook to fetch score trends
 */
export function useScoreTrends(domain?: string, days = 30) {
  return useQuery({
    queryKey: ["dashboard", "trends", domain, days],
    queryFn: async (): Promise<ScoreTrends> => {
      return api.dashboard.getTrends(domain, days);
    },
  });
}

/**
 * Hook to fetch alerts
 */
export function useAlerts() {
  return useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: async (): Promise<Alert[]> => {
      const response = await api.dashboard.getAlerts();
      return response.alerts;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
