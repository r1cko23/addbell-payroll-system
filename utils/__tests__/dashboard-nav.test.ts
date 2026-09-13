import { describe, expect, it } from "vitest";
import {
  DASHBOARD_NAV_GROUPS,
  filterDashboardNavGroups,
  findActiveDashboardNavGroup,
  type DashboardNavFilterContext,
} from "@/lib/dashboard-nav";

const allowAll: DashboardNavFilterContext = {
  role: "admin",
  isHR: false,
  isManagement: true,
  isOperationsManager: false,
  isApprover: false,
  isViewer: false,
  isAdmin: true,
  canRead: () => true,
};

describe("dashboard top-nav groups", () => {
  it("lists glance groups in Overview through Settings order", () => {
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Overview",
      "Projects",
      "People",
      "Time & Attendance",
      "Requests & Approvals",
      "Settings",
    ]);
  });

  it("keeps Executive Dashboard in Overview for management", () => {
    const groups = filterDashboardNavGroups(DASHBOARD_NAV_GROUPS, allowAll);
    const overview = groups.find((group) => group.label === "Overview");
    expect(overview?.items.map((item) => item.name)).toContain(
      "Executive Dashboard"
    );
  });

  it("hides Executive Dashboard and the Projects group for HR", () => {
    const groups = filterDashboardNavGroups(DASHBOARD_NAV_GROUPS, {
      ...allowAll,
      role: "hr",
      isHR: true,
      isManagement: false,
      isAdmin: false,
    });
    expect(groups.some((group) => group.label === "Projects")).toBe(false);
    const overview = groups.find((group) => group.label === "Overview");
    expect(overview?.items.map((item) => item.name)).not.toContain(
      "Executive Dashboard"
    );
    expect(overview?.items.map((item) => item.name)).toContain(
      "Workforce Overview"
    );
  });

  it("hides the People group for operations managers", () => {
    const groups = filterDashboardNavGroups(DASHBOARD_NAV_GROUPS, {
      ...allowAll,
      role: "operations_manager",
      isManagement: false,
      isOperationsManager: true,
      isAdmin: false,
    });
    expect(groups.some((group) => group.label === "People")).toBe(false);
    expect(groups.some((group) => group.label === "Projects")).toBe(true);
  });

  it("hides Storage Monitor unless the user is admin", () => {
    const officer = filterDashboardNavGroups(DASHBOARD_NAV_GROUPS, {
      ...allowAll,
      role: "purchasing_officer",
      isManagement: false,
      isAdmin: false,
    });
    const settings = officer.find((group) => group.label === "Settings");
    expect(settings?.items.map((item) => item.name)).not.toContain(
      "Storage Monitor"
    );

    const admin = filterDashboardNavGroups(DASHBOARD_NAV_GROUPS, allowAll);
    expect(
      admin
        .find((group) => group.label === "Settings")
        ?.items.map((item) => item.name)
    ).toContain("Storage Monitor");
  });

  it("highlights the Projects group for a nested project URL", () => {
    expect(
      findActiveDashboardNavGroup("/projects/abc", "", DASHBOARD_NAV_GROUPS)
    ).toBe("Projects");
  });

  it("highlights Overview from the workforce dashboard query", () => {
    expect(
      findActiveDashboardNavGroup(
        "/dashboard",
        "type=workforce",
        DASHBOARD_NAV_GROUPS
      )
    ).toBe("Overview");
  });

  it("returns no active group when the path is unknown", () => {
    expect(
      findActiveDashboardNavGroup("/login", "", DASHBOARD_NAV_GROUPS)
    ).toBeNull();
  });
});
