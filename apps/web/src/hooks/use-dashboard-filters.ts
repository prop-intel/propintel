"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export type TimeFramePreset = "12h" | "24h" | "3d" | "7d" | "30d" | "90d";

export interface DashboardFilters {
  timeFrame: TimeFramePreset;
  source?: "pixel" | "middleware";
  companies: string[];
}

export interface DashboardFilterParams {
  days?: number;
  hours?: number;
  source?: "pixel" | "middleware";
  companies?: string[];
}

// Time frame configurations
const TIME_FRAME_CONFIG: Record<
  TimeFramePreset,
  { hours?: number; days?: number; label: string; useHourly: boolean }
> = {
  "12h": { hours: 12, label: "Last 12 hours", useHourly: true },
  "24h": { hours: 24, label: "Last 24 hours", useHourly: true },
  "3d": { days: 3, label: "Last 3 days", useHourly: false },
  "7d": { days: 7, label: "Last 7 days", useHourly: false },
  "30d": { days: 30, label: "Last 30 days", useHourly: false },
  "90d": { days: 90, label: "Last 90 days", useHourly: false },
};

export function useDashboardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo((): DashboardFilters => {
    const tf = searchParams.get("tf");
    const validTimeFrames: TimeFramePreset[] = ["12h", "24h", "3d", "7d", "30d", "90d"];
    const timeFrame: TimeFramePreset = validTimeFrames.includes(tf as TimeFramePreset)
      ? (tf as TimeFramePreset)
      : "30d";
    const source = searchParams.get("source") as "pixel" | "middleware" | null;
    const companiesParam = searchParams.get("companies");
    const companies = companiesParam ? companiesParam.split(",").filter(Boolean) : [];

    return {
      timeFrame,
      source: source || undefined,
      companies,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (updates: Partial<DashboardFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.timeFrame !== undefined) {
        if (updates.timeFrame === "30d") {
          params.delete("tf"); // 30d is default, no need to store
        } else {
          params.set("tf", updates.timeFrame);
        }
      }

      if (updates.source !== undefined) {
        if (updates.source) {
          params.set("source", updates.source);
        } else {
          params.delete("source");
        }
      }

      if (updates.companies !== undefined) {
        if (updates.companies.length > 0) {
          params.set("companies", updates.companies.join(","));
        } else {
          params.delete("companies");
        }
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [searchParams, router, pathname]
  );

  // Convert to API params format
  const apiParams = useMemo((): DashboardFilterParams => {
    const { timeFrame, source, companies } = filters;
    const config = TIME_FRAME_CONFIG[timeFrame];

    const params: DashboardFilterParams = {};

    if (config.hours) {
      params.hours = config.hours;
    } else if (config.days) {
      params.days = config.days;
    }

    if (source) {
      params.source = source;
    }

    if (companies.length > 0) {
      params.companies = companies;
    }

    return params;
  }, [filters]);

  // Get config for current time frame
  const timeFrameConfig = useMemo(() => {
    return TIME_FRAME_CONFIG[filters.timeFrame];
  }, [filters.timeFrame]);

  return {
    filters,
    setFilters,
    apiParams,
    timeFrameLabel: timeFrameConfig.label,
    useHourlyAggregation: timeFrameConfig.useHourly,
  };
}
