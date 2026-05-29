import { isUserApproverForOvertimeGroup } from "@/lib/manager-approval-queue";
import {
  FINAL_HR_APPROVER_ID,
  getFirstApproverIdForGroup,
  normalizeGroupName,
  isFinalHrApprover,
} from "@/lib/requestApprovalRouting";

/** Groups where HR (final approver) is the designated first approver — manager step is skipped. */
export function isHrFirstApproverGroup(
  groupName: string | null | undefined,
  approverIdByGroupName: Record<string, string> = {}
): boolean {
  const n = normalizeGroupName(groupName);
  if (!n) return false;
  if (n === "hr laguna" || n === "laguna hr" || n.includes("hr laguna")) {
    return true;
  }
  const trimmed = (groupName || "").trim();
  const lower = trimmed.toLowerCase();
  const approverId =
    approverIdByGroupName[groupName!] ||
    approverIdByGroupName[trimmed] ||
    approverIdByGroupName[lower] ||
    approverIdByGroupName[n] ||
    getFirstApproverIdForGroup(groupName) ||
    null;
  return approverId === FINAL_HR_APPROVER_ID;
}

// —— Leave ——

export function isLeaveManagerStage(request: {
  status: string;
  project_manager_id?: string | null;
  account_manager_id?: string | null;
}): boolean {
  return request.status === "pending" && !request.project_manager_id;
}

export function isLeaveHrStage(request: { status: string }): boolean {
  return (
    request.status === "approved_by_pm" || request.status === "approved_by_manager"
  );
}

/** Ops manager actionable queue (first approval only). */
export function leaveRequestInOperationsManagerQueue(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>
): boolean {
  if (!isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName)) {
    return false;
  }
  return isLeaveManagerStage(request);
}

/** HR actionable queue: 2nd step, or 1st+final when HR is the group's first approver. */
export function leaveRequestInHrQueue(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>
): boolean {
  if (!userId) return false;

  const hrFirst = isHrFirstApproverGroup(groupName, approverIdByGroupName);
  const groupApprover = isUserApproverForOvertimeGroup(
    userId,
    groupName,
    approverIdByGroupName
  );

  if (hrFirst) {
    if (!groupApprover && !isFinalHrApprover(userId)) return false;
    return isLeaveManagerStage(request) || isLeaveHrStage(request);
  }

  if (!isFinalHrApprover(userId)) return false;
  return isLeaveHrStage(request);
}

export function canOperationsManagerViewLeaveRequest(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>,
  statusFilter: string
): boolean {
  if (!isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName)) {
    return false;
  }
  if (statusFilter === "pending") {
    return leaveRequestInOperationsManagerQueue(
      request,
      userId,
      groupName,
      approverIdByGroupName
    );
  }
  return true;
}

export function canHrViewLeaveRequest(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>,
  statusFilter: string
): boolean {
  if (statusFilter === "pending") {
    return leaveRequestInHrQueue(request, userId, groupName, approverIdByGroupName);
  }

  const hrFirst = isHrFirstApproverGroup(groupName, approverIdByGroupName);
  if (hrFirst) {
    return isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName);
  }

  if (!isFinalHrApprover(userId)) return false;

  return (
    isLeaveHrStage(request) ||
    request.status === "approved_by_hr" ||
    request.status === "rejected" ||
    request.status === "cancelled"
  );
}

// —— Overtime & FTL (manager endorsement fields) ——

export function isOtOrFtlManagerStage(request: {
  status: string;
  project_manager_id?: string | null;
  account_manager_id?: string | null;
}): boolean {
  return (
    request.status === "pending" &&
    !request.project_manager_id &&
    !request.account_manager_id
  );
}

export function isOtOrFtlHrStage(request: {
  status: string;
  project_manager_id?: string | null;
  account_manager_id?: string | null;
}): boolean {
  return (
    request.status === "pending" &&
    Boolean(request.project_manager_id || request.account_manager_id)
  );
}

export function isFtlManagerStage(request: {
  status: string;
  account_manager_id?: string | null;
}): boolean {
  return request.status === "pending" && !request.account_manager_id;
}

export function isFtlHrStage(request: {
  status: string;
  account_manager_id?: string | null;
}): boolean {
  return request.status === "pending" && Boolean(request.account_manager_id);
}

export function overtimeRequestInOperationsManagerQueue(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>
): boolean {
  if (!isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName)) {
    return false;
  }
  return isOtOrFtlManagerStage(request);
}

export function overtimeRequestInHrQueue(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>
): boolean {
  if (!userId) return false;

  const hrFirst = isHrFirstApproverGroup(groupName, approverIdByGroupName);
  const groupApprover = isUserApproverForOvertimeGroup(
    userId,
    groupName,
    approverIdByGroupName
  );

  if (hrFirst) {
    if (!groupApprover && !isFinalHrApprover(userId)) return false;
    return isOtOrFtlManagerStage(request) || isOtOrFtlHrStage(request);
  }

  if (!isFinalHrApprover(userId)) return false;
  return isOtOrFtlHrStage(request);
}

export function ftlRequestInOperationsManagerQueue(
  request: { status: string; account_manager_id?: string | null },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>
): boolean {
  if (!isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName)) {
    return false;
  }
  return isFtlManagerStage(request);
}

export function ftlRequestInHrQueue(
  request: { status: string; account_manager_id?: string | null },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>
): boolean {
  if (!userId) return false;

  const hrFirst = isHrFirstApproverGroup(groupName, approverIdByGroupName);
  const groupApprover = isUserApproverForOvertimeGroup(
    userId,
    groupName,
    approverIdByGroupName
  );

  if (hrFirst) {
    if (!groupApprover && !isFinalHrApprover(userId)) return false;
    return isFtlManagerStage(request) || isFtlHrStage(request);
  }

  if (!isFinalHrApprover(userId)) return false;
  return isFtlHrStage(request);
}

export function canOperationsManagerViewOtRequest(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>,
  statusFilter: string
): boolean {
  if (!isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName)) {
    return false;
  }
  if (statusFilter === "pending") {
    return overtimeRequestInOperationsManagerQueue(
      request,
      userId,
      groupName,
      approverIdByGroupName
    );
  }
  return true;
}

export function canHrViewOtRequest(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
  },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>,
  statusFilter: string
): boolean {
  if (statusFilter === "pending") {
    return overtimeRequestInHrQueue(request, userId, groupName, approverIdByGroupName);
  }

  const hrFirst = isHrFirstApproverGroup(groupName, approverIdByGroupName);
  if (hrFirst) {
    return isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName);
  }

  if (!isFinalHrApprover(userId)) return false;

  return (
    isOtOrFtlHrStage(request) ||
    request.status === "approved" ||
    request.status === "rejected"
  );
}

export function canOperationsManagerViewFtlRequest(
  request: { status: string; account_manager_id?: string | null },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>,
  statusFilter: string
): boolean {
  if (!isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName)) {
    return false;
  }
  if (statusFilter === "pending") {
    return ftlRequestInOperationsManagerQueue(
      request,
      userId,
      groupName,
      approverIdByGroupName
    );
  }
  return true;
}

export function canHrViewFtlRequest(
  request: { status: string; account_manager_id?: string | null },
  userId: string | null,
  groupName: string | null,
  approverIdByGroupName: Record<string, string>,
  statusFilter: string
): boolean {
  if (statusFilter === "pending") {
    return ftlRequestInHrQueue(request, userId, groupName, approverIdByGroupName);
  }

  const hrFirst = isHrFirstApproverGroup(groupName, approverIdByGroupName);
  if (hrFirst) {
    return isUserApproverForOvertimeGroup(userId, groupName, approverIdByGroupName);
  }

  if (!isFinalHrApprover(userId)) return false;

  return (
    isFtlHrStage(request) ||
    request.status === "approved" ||
    request.status === "rejected"
  );
}

/** HR "pending" tab must not use a single status=eq on the server. */
export function shouldSkipServerStatusFilterForHrPending(
  isHR: boolean,
  statusFilter: string
): boolean {
  return isHR && statusFilter === "pending";
}

/** Any leave still in the approval workflow (manager or HR step). */
export function leaveRequestAwaitingApproval(request: {
  status: string;
  project_manager_id?: string | null;
  account_manager_id?: string | null;
}): boolean {
  return isLeaveManagerStage(request) || isLeaveHrStage(request);
}

/** OT still awaiting manager and/or HR action. */
export function overtimeRequestAwaitingApproval(request: {
  status: string;
  project_manager_id?: string | null;
  account_manager_id?: string | null;
}): boolean {
  return (
    request.status === "pending" &&
    (isOtOrFtlManagerStage(request) || isOtOrFtlHrStage(request))
  );
}

/** FTL still awaiting manager and/or HR action. */
export function ftlRequestAwaitingApproval(request: {
  status: string;
  account_manager_id?: string | null;
}): boolean {
  return (
    request.status === "pending" &&
    (isFtlManagerStage(request) || isFtlHrStage(request))
  );
}
