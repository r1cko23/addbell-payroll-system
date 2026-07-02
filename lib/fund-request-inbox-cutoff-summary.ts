import {
  isFundRequestReturnedToPurchasing,
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

  if (request.purchasing_officer_approved_at) return true;
  if (isPoFundRequestRejection(request)) return true;
  if (request.status === "project_manager_approved") return true;
  if (request.status === "purchasing_officer_approved") return true;
  if (request.status === "management_approved") return true;
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
