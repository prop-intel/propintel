"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "@/trpc/react";
import { useSiteStore } from "@/stores/site-store";

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
  const { activeSiteId, setActiveSiteId } = useSiteStore();
  const { data: sites = [], isLoading } = api.site.list.useQuery();
  const [activeSite, setActiveSiteState] = useState<Site | null>(null);

  // Resolve active site from stored ID or default to first site
  useEffect(() => {
    if (sites.length === 0) {
      setActiveSiteState(null);
      return;
    }

    const site = activeSiteId
      ? sites.find((s) => s.id === activeSiteId)
      : sites[0];

    // If stored ID doesn't match any site, default to first
    const resolvedSite = site ?? sites[0] ?? null;
    setActiveSiteState(resolvedSite);

    // Update store if we defaulted to first site
    if (!site && resolvedSite) {
      setActiveSiteId(resolvedSite.id);
    }
  }, [sites, activeSiteId, setActiveSiteId]);

  const setActiveSite = (site: Site | null) => {
    setActiveSiteState(site);
    setActiveSiteId(site?.id ?? null);
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
