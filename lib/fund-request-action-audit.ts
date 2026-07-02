import type {
  FundRequestActionHistoryEntry,
  FundRequestActionType,
  FundRequestRow,
} from "@/types/fund-request";
import { getFundRequestRejectionHistory } from "@/lib/fund-request-rejection-history";

export const FUND_REQUEST_ACTION_LABELS: Record<FundRequestActionType, string> = {
  reject: "Rejected",
  return_to_purchasing: "Returned to Purchasing",
  return_to_operations_manager: "Returned to Operations Manager",
};

const MISLABELED_RETURN_REASON_PATTERNS = [
  /will be approved later/i,
  /will approve later/i,
  /system to be fixed/i,
  /fix details/i,
  /input subcon/i,
];

export function normalizeFundRequestActionType(
  action: string | null | undefined
): FundRequestActionType {
  if (
    action === "return_to_purchasing" ||
    action === "return_to_operations_manager" ||
    action === "reject"
  ) {
    return action;
  }
  return "reject";
}

export function getFundRequestActionHistory(
  request: Pick<FundRequestRow, "rejection_history">
): FundRequestActionHistoryEntry[] {
  return getFundRequestRejectionHistory(request).map((entry) => ({
    ...entry,
    action: normalizeFundRequestActionType(entry.action),
  }));
}

export function isLikelyMislabeledReturnAsRejection(
  request: Pick<
    FundRequestRow,
    | "status"
    | "rejection_reason"
    | "rejection_undo_snapshot"
    | "purchasing_officer_approved_at"
    | "rejection_history"
  >
): boolean {
  if (request.status !== "rejected") return false;
  if (request.purchasing_officer_approved_at) return false;
  if (request.rejection_undo_snapshot?.status !== "purchasing_officer_approved") {
    return false;
  }

  const history = getFundRequestActionHistory(request);
  if (history.some((entry) => entry.action !== "reject" && !entry.undone_at)) {
    return false;
  }

  const reason = request.rejection_reason?.trim() ?? "";
  if (!reason) return true;
  return MISLABELED_RETURN_REASON_PATTERNS.some((pattern) => pattern.test(reason));
}

export function getFundRequestDispositionLabel(
  request: Pick<
    FundRequestRow,
    | "status"
    | "rejection_reason"
    | "rejection_undo_snapshot"
    | "purchasing_officer_approved_at"
    | "rejection_history"
    | "returned_at"
  >
): string | null {
  if (isLikelyMislabeledReturnAsRejection(request)) {
    return "Returned to Purchasing (mislabeled as rejected)";
  }
  if (request.status === "rejected") return FUND_REQUEST_ACTION_LABELS.reject;
  if (request.returned_at) return FUND_REQUEST_ACTION_LABELS.return_to_purchasing;
  return null;
}

export function getFundRequestActionHistoryActorIds(
  request: Pick<FundRequestRow, "rejection_history" | "rejected_by" | "returned_by">
): string[] {
  const ids = new Set<string>();
  if (request.rejected_by) ids.add(request.rejected_by);
  if (request.returned_by) ids.add(request.returned_by);
  for (const entry of getFundRequestActionHistory(request)) {
    ids.add(entry.rejected_by);
    if (entry.undone_by) ids.add(entry.undone_by);
  }
  return [...ids];
}

export function formatFundRequestActionHistoryEntry(
  entry: FundRequestActionHistoryEntry,
  approverNames: Record<string, string>
): string {
  const action = normalizeFundRequestActionType(entry.action);
  const actor = approverNames[entry.rejected_by] ?? "Unknown user";
  const reason = entry.rejection_reason?.trim();
  const undone = entry.undone_at
    ? ` (undone by ${approverNames[entry.undone_by ?? ""] ?? "admin"})`
    : "";
  return `${FUND_REQUEST_ACTION_LABELS[action]} by ${actor}${reason ? ` — ${reason}` : ""}${undone}`;
}
