"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DASHBOARD_NAV_GROUPS,
  filterDashboardNavGroups,
  findActiveDashboardNavGroup,
  type DashboardNavGroup,
} from "@/lib/dashboard-nav";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useUserRole } from "@/lib/hooks/useUserRole";

export function useDashboardNavGroups(): {
  groups: DashboardNavGroup[];
  activeGroup: string | null;
  loading: boolean;
} {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const {
    role,
    isHR,
    isManagement,
    isOperationsManager,
    isApprover,
    isViewer,
    isAdmin,
    loading: roleLoading,
  } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const loading = roleLoading || permissionsLoading;

  const groups = useMemo(() => {
    if (loading) return [];
    return filterDashboardNavGroups(DASHBOARD_NAV_GROUPS, {
      role,
      isHR,
      isManagement,
      isOperationsManager,
      isApprover,
      isViewer,
      isAdmin,
      canRead,
    });
  }, [
    loading,
    role,
    isHR,
    isManagement,
    isOperationsManager,
    isApprover,
    isViewer,
    isAdmin,
    canRead,
  ]);

  const activeGroup = findActiveDashboardNavGroup(
    pathname,
    searchKey,
    DASHBOARD_NAV_GROUPS
  );

  return { groups, activeGroup, loading };
}
