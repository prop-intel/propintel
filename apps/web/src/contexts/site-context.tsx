"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { setActiveSiteCookie } from "@/lib/cookies";

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

interface SiteProviderProps {
  children: ReactNode;
  initialSites: Site[];
  initialActiveSite: Site | null;
}

export function SiteProvider({
  children,
  initialSites,
  initialActiveSite,
}: SiteProviderProps) {
  const router = useRouter();
  const [activeSite, setActiveSiteState] = useState<Site | null>(initialActiveSite);
  const [sites, setSites] = useState<Site[]>(initialSites);

  // Sync with server props when they change (after router.refresh() or page reload)
  useEffect(() => {
    setActiveSiteState(initialActiveSite);
  }, [initialActiveSite?.id]);

  useEffect(() => {
    setSites(initialSites);
  }, [initialSites]);

  const setActiveSite = (site: Site | null) => {
    if (site) {
      setActiveSiteCookie(site.id);
    }
    // Update local state immediately for instant UI feedback
    setActiveSiteState(site);
    // Refresh the page to re-fetch server data with new site
    router.refresh();
  };

  return (
    <SiteContext.Provider
      value={{
        activeSite,
        setActiveSite,
        sites,
        isLoading: false,
      }}
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
