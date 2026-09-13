"use client";

import { useEffect, useState } from "react";
import {
  DASHBOARD_MD_BREAKPOINT_PX,
  dashboardViewportTier,
  type DashboardViewportTier,
} from "@/lib/dashboard-viewport";

export function useDashboardViewportTier(): DashboardViewportTier {
  const [tier, setTier] = useState<DashboardViewportTier>(() =>
    typeof window === "undefined"
      ? "desktop"
      : dashboardViewportTier(window.innerWidth)
  );

  useEffect(() => {
    const media = window.matchMedia(
      `(min-width: ${DASHBOARD_MD_BREAKPOINT_PX}px)`
    );
    const apply = () => setTier(media.matches ? "desktop" : "mobile");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return tier;
}
