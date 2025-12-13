"use client";

import {
  createContext,
  useContext,
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

  const setActiveSite = (site: Site | null) => {
    if (site) {
      setActiveSiteCookie(site.id);
    }
    // Refresh the page to re-fetch data with new site
    router.refresh();
  };

  return (
    <SiteContext.Provider
      value={{
        activeSite: initialActiveSite,
        setActiveSite,
        sites: initialSites,
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
