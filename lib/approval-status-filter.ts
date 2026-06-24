/** Client-side status filter for OT approval queues (first-approver viewer status). */
export function matchesOtApprovalStatusFilter(
  _dbStatus: string,
  viewerStatus: string,
  statusFilter: string
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "pending") return viewerStatus === "pending";
  if (statusFilter === "approved") {
    return (
      viewerStatus === "approved" || viewerStatus === "approved_by_manager"
    );
  }
  if (statusFilter === "rejected") return viewerStatus === "rejected";
  return viewerStatus === statusFilter;
}

/** Client-side status filter for failure-to-log approval queues. */
export function matchesFtlApprovalStatusFilter(
  _dbStatus: string,
  viewerStatus: string,
  statusFilter: string
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "pending") return viewerStatus === "pending";
  if (statusFilter === "approved") return viewerStatus === "approved";
  if (statusFilter === "rejected") return viewerStatus === "rejected";
  return viewerStatus === statusFilter;
}

/** Client-side status filter for leave approval queues. */
export function matchesLeaveApprovalStatusFilter(
  _dbStatus: string,
  viewerStatus: string,
  statusFilter: string
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "pending") return viewerStatus === "pending";
  if (statusFilter === "approved_by_pm") {
    return viewerStatus === "approved_by_pm";
  }
  if (statusFilter === "approved_by_hr") {
    return viewerStatus === "approved_by_hr";
  }
  if (statusFilter === "rejected") return viewerStatus === "rejected";
  return viewerStatus === statusFilter;
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

type ApprovalQueueKind = "ot" | "ftl" | "leave";

/**
 * Whether the server should apply a DB status filter for the current viewer.
 * First-approver "approved" / "approved_by_pm" are viewer-relative (endorsed
 * items may still be DB pending), so those filters run client-side only.
 */
export function shouldApplyServerStatusFilter(
  statusFilter: string,
  options: {
    isHR: boolean;
    isFirstApproverDashboardView: boolean;
    queueKind: ApprovalQueueKind;
  }
): boolean {
  if (statusFilter === "all") return false;
  if (options.isHR && statusFilter === "pending") return false;

  if (options.isFirstApproverDashboardView) {
    if (statusFilter === "pending") return false;
    if (statusFilter === "approved" && options.queueKind !== "leave") {
      return false;
    }
    if (statusFilter === "approved_by_pm" && options.queueKind === "leave") {
      return false;
    }
    return statusFilter === "rejected";
  }

  return true;
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
