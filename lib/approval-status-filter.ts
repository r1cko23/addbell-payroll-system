/** Client-side status filter for OT approval queues (first-approver viewer status). */
export function matchesOtApprovalStatusFilter(
  dbStatus: string,
  viewerStatus: string,
  statusFilter: string
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "pending") return viewerStatus === "pending";
  if (statusFilter === "approved") return dbStatus === "approved";
  if (statusFilter === "rejected") return dbStatus === "rejected";
  return dbStatus === statusFilter;
}

/** Client-side status filter for failure-to-log approval queues. */
export function matchesFtlApprovalStatusFilter(
  dbStatus: string,
  viewerStatus: string,
  statusFilter: string
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "pending") return viewerStatus === "pending";
  if (statusFilter === "approved") return dbStatus === "approved";
  if (statusFilter === "rejected") return dbStatus === "rejected";
  return viewerStatus === statusFilter;
}

/** Client-side status filter for leave approval queues. */
export function matchesLeaveApprovalStatusFilter(
  dbStatus: string,
  viewerStatus: string,
  statusFilter: string
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "pending") return viewerStatus === "pending";
  if (statusFilter === "approved_by_pm") {
    return (
      dbStatus === "approved_by_pm" ||
      dbStatus === "approved_by_manager" ||
      viewerStatus === "approved_by_pm"
    );
  }
  if (statusFilter === "approved_by_hr") return dbStatus === "approved_by_hr";
  if (statusFilter === "rejected") return dbStatus === "rejected";
  return dbStatus === statusFilter;
}

/**
 * Ops manager / upper management use viewer-relative status labels.
 * HR and admin rely on DB status + queue visibility rules instead.
 */
export function shouldApplyViewerStatusFilter(
  isFirstApproverDashboardView: boolean
): boolean {
  return isFirstApproverDashboardView;
}

export function filterOtRequestsByStatus<T extends { status: string }>(
  rows: T[],
  statusFilter: string,
  isFirstApproverDashboardView: boolean,
  getViewerStatus: (row: T) => string
): T[] {
  if (!shouldApplyViewerStatusFilter(isFirstApproverDashboardView)) {
    return rows;
  }
  return rows.filter((r) =>
    matchesOtApprovalStatusFilter(r.status, getViewerStatus(r), statusFilter)
  );
}

export function filterFtlRequestsByStatus<T extends { status: string }>(
  rows: T[],
  statusFilter: string,
  isFirstApproverDashboardView: boolean,
  getViewerStatus: (row: T) => string
): T[] {
  if (!shouldApplyViewerStatusFilter(isFirstApproverDashboardView)) {
    return rows;
  }
  return rows.filter((r) =>
    matchesFtlApprovalStatusFilter(r.status, getViewerStatus(r), statusFilter)
  );
}

export function filterLeaveRequestsByStatus<T extends { status: string }>(
  rows: T[],
  statusFilter: string,
  isFirstApproverDashboardView: boolean,
  getViewerStatus: (row: T) => string
): T[] {
  if (!shouldApplyViewerStatusFilter(isFirstApproverDashboardView)) {
    return rows;
  }
  return rows.filter((r) =>
    matchesLeaveApprovalStatusFilter(r.status, getViewerStatus(r), statusFilter)
  );
}
