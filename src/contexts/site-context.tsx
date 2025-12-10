"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/trpc/react";

type Site = {
  id: string;
  domain: string;
  name: string | null;
  trackingId: string;
};

type SiteContextType = {
  activeSite: Site | null;
  setActiveSite: (site: Site | null) => void;
  sites: Site[];
  isLoading: boolean;
};

const SiteContext = createContext<SiteContextType | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteIdParam = searchParams.get("site");

  const { data: sites = [], isLoading } = api.site.list.useQuery();
  const [activeSite, setActiveSiteState] = useState<Site | null>(null);

  // Sync active site with URL param or default to first site
  useEffect(() => {
    if (sites.length === 0) {
      setActiveSiteState(null);
      return;
    }

    const site = siteIdParam
      ? sites.find((s) => s.id === siteIdParam)
      : sites[0];

    setActiveSiteState(site ?? sites[0] ?? null);
  }, [sites, siteIdParam]);

  const setActiveSite = (site: Site | null) => {
    setActiveSiteState(site);
    if (site) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("site", site.id);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <SiteContext.Provider
      value={{ activeSite, setActiveSite, sites, isLoading }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return context;
}
