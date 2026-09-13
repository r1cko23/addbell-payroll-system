import { describe, expect, it } from "vitest";
import {
  DASHBOARD_MD_BREAKPOINT_PX,
  dashboardViewportTier,
  shouldMountDashboardViewportTree,
} from "@/lib/dashboard-viewport";

describe("dashboard viewport trees", () => {
  it("does not mount the hidden tree so a portaled select cannot open twice", () => {
    expect(DASHBOARD_MD_BREAKPOINT_PX).toBe(768);
    expect(dashboardViewportTier(1440)).toBe("desktop");
    expect(dashboardViewportTier(767)).toBe("mobile");

    expect(shouldMountDashboardViewportTree("desktop", "desktop")).toBe(true);
    expect(shouldMountDashboardViewportTree("mobile", "desktop")).toBe(false);
    expect(shouldMountDashboardViewportTree("mobile", "mobile")).toBe(true);
    expect(shouldMountDashboardViewportTree("desktop", "mobile")).toBe(false);
  });
});
