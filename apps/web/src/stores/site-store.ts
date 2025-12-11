import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SiteStore {
  activeSiteId: string | null;
  setActiveSiteId: (id: string | null) => void;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set) => ({
      activeSiteId: null,
      setActiveSiteId: (id) => set({ activeSiteId: id }),
    }),
    { name: "site-store" }
  )
);
