import {
  isFundRequestReturnedToPurchasing,
  isPurchasingOfficerOwnFundRequest,
} from "@/lib/fund-request-approval";
import {
  fundRequestBelongsToApproverCutoff,
  isFundRequestUpperManagementFinalRejection,
  isPoFundRequestRejection,
} from "@/lib/fund-request-cutoff";
import {
  fundRequestInOperationsManagerQueue,
  fundRequestSkippedOperationsManagerApproval,
  type FundRequestRequesterRouting,
} from "@/lib/fund-request-routing";
import { normalizeUserRole } from "@/lib/user-roles";
import type { FundRequestRow } from "@/types/fund-request";
import type { WeeklyCutoffPeriod } from "@/utils/weekly";

export type FundRequestRoleCutoffBucket = "approved" | "rejected" | "pending";

export type FundRequestRoleCutoffOutcomeFilter = "all" | FundRequestRoleCutoffBucket;

export type FundRequestRoleCutoffSummary = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  amounts: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
};

type SummaryContext = {
  managedRequesterIds?: ReadonlySet<string>;
  requesterRoutingById?: Record<string, FundRequestRequesterRouting>;
  approverUserId?: string | null;
  requesterUserIdByEmployeeId?: Record<string, string | null | undefined>;
};

function emptySummary(): FundRequestRoleCutoffSummary {
  return {
    total: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    amounts: { total: 0, approved: 0, rejected: 0, pending: 0 },
  };
}

function getRouting(
  request: Pick<FundRequestRow, "requested_by">,
  ctx: SummaryContext
): FundRequestRequesterRouting | undefined {
  return ctx.requesterRoutingById?.[request.requested_by];
}

function isOmScopedRequest(
  request: Pick<FundRequestRow, "requested_by">,
  ctx: SummaryContext
): boolean {
  const managedIds = ctx.managedRequesterIds;
  if (!managedIds?.has(request.requested_by)) return false;
  const routing = getRouting(request, ctx);
  return Boolean(routing?.requiresOperationsManagerApproval);
}

function isPoScopedRequest(
  request: FundRequestRow,
  ctx: SummaryContext
): boolean {
  if (
    isPurchasingOfficerOwnFundRequest(request, {
      approverUserId: ctx.approverUserId,
      requesterUserIdByEmployeeId: ctx.requesterUserIdByEmployeeId,
    })
  ) {
    return false;
  }

  // Keep requests in purchasing metrics after PO acts, even when UM is next.
  if (request.purchasing_officer_approved_at) return true;
  if (isPoFundRequestRejection(request)) return true;
  if (request.status === "management_approved") return true;

  const routing = getRouting(request, ctx);
  if (
    routing &&
    fundRequestSkippedOperationsManagerApproval(
      request,
      routing.requiresOperationsManagerApproval
    )
  ) {
    return false;
  }

  if (request.status === "project_manager_approved") return true;
  if (request.status === "purchasing_officer_approved") return true;
  return false;
}

function isUmScopedRequest(request: FundRequestRow): boolean {
  if (request.purchasing_officer_approved_at) return true;
  if (request.status === "management_approved") return true;
  if (isFundRequestUpperManagementFinalRejection(request)) return true;
  if (request.status === "purchasing_officer_approved") return true;
  return false;
}

function isInRoleCutoffScope(
  request: FundRequestRow,
  role: string | null | undefined,
  ctx: SummaryContext
): boolean {
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === "admin") return true;
  if (normalizedRole === "operations_manager") return isOmScopedRequest(request, ctx);
  if (normalizedRole === "purchasing_officer") return isPoScopedRequest(request, ctx);
  if (normalizedRole === "upper_management") return isUmScopedRequest(request);
  return false;
}

export function matchesFundRequestRoleCutoffFilter(
  request: FundRequestRow,
  filter: FundRequestRoleCutoffOutcomeFilter,
  role: string | null | undefined,
  ctx: SummaryContext = {}
): boolean {
  if (!isInRoleCutoffScope(request, role, ctx)) return false;
  if (filter === "all") return true;
  return getFundRequestRoleCutoffBucket(request, role, ctx) === filter;
}

export function getFundRequestRoleCutoffMetricLabels(
  role: string | null | undefined
): {
  total: string;
  approved: string;
  rejected: string;
  pending: string;
} {
  const normalizedRole = normalizeUserRole(role);
  const stageSuffix =
    normalizedRole === "operations_manager"
      ? "(Operations)"
      : normalizedRole === "purchasing_officer"
        ? "(Purchasing)"
        : normalizedRole === "upper_management"
          ? "(Upper Management)"
          : null;

  if (!stageSuffix) {
    return {
      total: "Total",
      approved: "Approved",
      rejected: "Rejected",
      pending: "Pending",
    };
  }

  return {
    total: "Total",
    approved: `Approved ${stageSuffix}`,
    rejected: `Rejected ${stageSuffix}`,
    pending: `Pending ${stageSuffix}`,
  };
}

export function getFundRequestRoleCutoffFilterOptions(
  role: string | null | undefined
): Array<{ value: FundRequestRoleCutoffOutcomeFilter; label: string }> {
  const labels = getFundRequestRoleCutoffMetricLabels(role);
  return [
    { value: "all", label: "All" },
    { value: "approved", label: labels.approved },
    { value: "rejected", label: labels.rejected },
    { value: "pending", label: labels.pending },
  ];
}

export function getFundRequestRoleCutoffBucket(
  request: FundRequestRow,
  role: string | null | undefined,
  ctx: SummaryContext = {}
): FundRequestRoleCutoffBucket | null {
  const normalizedRole = normalizeUserRole(role);

  if (normalizedRole === "operations_manager") {
    if (!isOmScopedRequest(request, ctx)) return null;
    if (fundRequestInOperationsManagerQueue(request, ctx.managedRequesterIds ?? [])) {
      return "pending";
    }
    if (request.status === "rejected" && !request.project_manager_approved_by) {
      return "rejected";
    }
    if (request.project_manager_approved_by) return "approved";
    if (request.status !== "pending") return "approved";
    return null;
  }

  if (normalizedRole === "purchasing_officer") {
    if (!isPoScopedRequest(request, ctx)) return null;
    if (isPoFundRequestRejection(request)) return "rejected";
    if (request.purchasing_officer_approved_at) return "approved";
    if (
      isPurchasingOfficerOwnFundRequest(request, {
        approverUserId: ctx.approverUserId,
        requesterUserIdByEmployeeId: ctx.requesterUserIdByEmployeeId,
      })
    ) {
      return null;
    }
    if (
      request.status === "project_manager_approved" ||
      isFundRequestReturnedToPurchasing(request)
    ) {
      return "pending";
    }
    return null;
  }

  if (normalizedRole === "upper_management") {
    if (!isUmScopedRequest(request)) return null;
    if (request.status === "management_approved") return "approved";
    if (isFundRequestUpperManagementFinalRejection(request)) return "rejected";
    if (request.status === "purchasing_officer_approved") return "pending";
    return null;
  }

  if (normalizedRole === "admin") {
    if (request.status === "management_approved") return "approved";
    if (request.status === "rejected" && !isFundRequestReturnedToPurchasing(request)) {
      return "rejected";
    }
    if (
      request.status === "pending" ||
      request.status === "project_manager_approved" ||
      request.status === "purchasing_officer_approved"
    ) {
      return "pending";
    }
    return "pending";
  }

  return null;
}

export function summarizeFundRequestsForRoleCutoff(
  requests: readonly FundRequestRow[],
  cutoff: WeeklyCutoffPeriod,
  role: string | null | undefined,
  ctx: SummaryContext = {}
): FundRequestRoleCutoffSummary {
  const summary = emptySummary();

  for (const row of requests) {
    if (!fundRequestBelongsToApproverCutoff(row, cutoff, "upper_management")) continue;
    if (!isInRoleCutoffScope(row, role, ctx)) continue;

    const bucket = getFundRequestRoleCutoffBucket(row, role, ctx);
    if (!bucket) continue;

    const amount = Number(row.total_requested_amount ?? 0);
    summary.total += 1;
    summary.amounts.total += amount;
    summary[bucket] += 1;
    summary.amounts[bucket] += amount;
  }

  return summary;
}
