"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, Clock } from "lucide-react";
import {
  useDashboardFilters,
  type TimeFramePreset,
} from "@/hooks/use-dashboard-filters";
import { api } from "@/trpc/react";

interface DashboardFiltersProps {
  siteId: string;
}

const TIME_FRAME_OPTIONS: { value: TimeFramePreset; label: string; group: "recent" | "extended" }[] = [
  { value: "12h", label: "Last 12 hours", group: "recent" },
  { value: "24h", label: "Last 24 hours", group: "recent" },
  { value: "3d", label: "Last 3 days", group: "recent" },
  { value: "7d", label: "Last 7 days", group: "extended" },
  { value: "30d", label: "Last 30 days", group: "extended" },
  { value: "90d", label: "Last 90 days", group: "extended" },
];

export function DashboardFilters({ siteId }: DashboardFiltersProps) {
  const { filters, setFilters } = useDashboardFilters();
  const { data: crawlersList } = api.analytics.getCrawlersList.useQuery(
    { siteId },
    { enabled: !!siteId }
  );

  const recentOptions = TIME_FRAME_OPTIONS.filter((o) => o.group === "recent");
  const extendedOptions = TIME_FRAME_OPTIONS.filter((o) => o.group === "extended");

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Time Frame Selection */}
      <Select
        value={filters.timeFrame}
        onValueChange={(value) => setFilters({ timeFrame: value as TimeFramePreset })}
      >
        <SelectTrigger className="w-[160px]" size="sm">
          <Clock className="mr-2 h-4 w-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Recent</SelectLabel>
            {recentOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Extended</SelectLabel>
            {extendedOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Source Filter */}
      <Select
        value={filters.source ?? "all"}
        onValueChange={(value) =>
          setFilters({
            source: value === "all" ? undefined : (value as "pixel" | "middleware"),
          })
        }
      >
        <SelectTrigger className="w-[140px]" size="sm">
          <SelectValue placeholder="All Sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="pixel">Pixel</SelectItem>
          <SelectItem value="middleware">Middleware</SelectItem>
        </SelectContent>
      </Select>

      {/* Bot Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            {filters.companies.length === 0
              ? "All Bots"
              : `${filters.companies.length} selected`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px]" align="start">
          <div className="space-y-3">
            <div className="font-medium text-sm">Filter by Company</div>
            {crawlersList?.companies.length === 0 && (
              <p className="text-sm text-muted-foreground">No crawlers yet</p>
            )}
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {crawlersList?.companies.map((company) => (
                <label
                  key={company}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={filters.companies.includes(company)}
                    onCheckedChange={(checked) => {
                      const updated = checked
                        ? [...filters.companies, company]
                        : filters.companies.filter((c) => c !== company);
                      setFilters({ companies: updated });
                    }}
                  />
                  <span className="text-sm">{company}</span>
                </label>
              ))}
            </div>
            {filters.companies.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setFilters({ companies: [] })}
              >
                Clear All
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
