import type {
  FundRequestActionHistoryEntry,
  FundRequestActionType,
  FundRequestRow,
} from "@/types/fund-request";
import { normalizeFundRequestActionType } from "@/lib/fund-request-action-audit";

export type { FundRequestActionHistoryEntry };
/** @deprecated Use FundRequestActionHistoryEntry */
export type { FundRequestActionHistoryEntry as FundRequestRejectionHistoryEntry };

function parseRejectionHistory(
  value: FundRequestRow["rejection_history"] | unknown
): FundRequestActionHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is FundRequestActionHistoryEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as FundRequestActionHistoryEntry).rejected_by === "string" &&
        typeof (entry as FundRequestActionHistoryEntry).rejected_at === "string"
    )
    .map((entry) => ({
      ...entry,
      action: normalizeFundRequestActionType(entry.action),
    }));
}

export function getFundRequestRejectionHistory(
  request: Pick<FundRequestRow, "rejection_history">
): FundRequestActionHistoryEntry[] {
  return parseRejectionHistory(request.rejection_history);
}

export function getActiveFundRequestRejection(
  request: Pick<
    FundRequestRow,
    | "rejection_history"
    | "status"
    | "rejected_by"
    | "rejected_at"
    | "rejection_reason"
  >
): FundRequestActionHistoryEntry | null {
  const history = getFundRequestRejectionHistory(request);
  const activeFromHistory = [...history]
    .reverse()
    .find((entry) => !entry.undone_at && entry.action === "reject");
  if (activeFromHistory) return activeFromHistory;

  if (request.status !== "rejected" || !request.rejected_by || !request.rejected_at) {
    return null;
  }

  return {
    action: "reject",
    rejected_by: request.rejected_by,
    rejected_at: request.rejected_at,
    rejection_reason: request.rejection_reason,
    undone_at: null,
    undone_by: null,
  };
}

export function appendFundRequestRejectionHistory(
  history: FundRequestRow["rejection_history"] | unknown,
  entry: Omit<FundRequestActionHistoryEntry, "undone_at" | "undone_by">
): FundRequestActionHistoryEntry[] {
  return [
    ...parseRejectionHistory(history),
    {
      ...entry,
      action: normalizeFundRequestActionType(entry.action),
      undone_at: null,
      undone_by: null,
    },
  ];
}

export function appendFundRequestActionHistory(
  history: FundRequestRow["rejection_history"] | unknown,
  entry: {
    action: FundRequestActionType;
    actorId: string;
    actedAt?: string;
    reason: string | null;
  }
): FundRequestActionHistoryEntry[] {
  const actedAt = entry.actedAt ?? new Date().toISOString();
  return appendFundRequestRejectionHistory(history, {
    action: entry.action,
    rejected_by: entry.actorId,
    rejected_at: actedAt,
    rejection_reason: entry.reason,
  });
}

export function markLatestFundRequestRejectionUndone(
  history: FundRequestRow["rejection_history"] | unknown,
  undoneBy: string,
  undoneAt: string,
  options?: { action?: FundRequestActionType }
): FundRequestActionHistoryEntry[] {
  const entries = parseRejectionHistory(history);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry?.undone_at) {
      if (options?.action && entry.action !== options.action) continue;
      entries[index] = {
        ...entry,
        undone_at: undoneAt,
        undone_by: undoneBy,
      };
      break;
    }
  }
  return entries;
}

export function buildFundRequestRejectionRestoreUpdates(
  request: FundRequestRow,
  entry: FundRequestActionHistoryEntry
): Record<string, unknown> {
  const snapshot = request.rejection_undo_snapshot;
  return {
    status: "rejected",
    rejected_by: entry.rejected_by,
    rejected_at: entry.rejected_at,
    rejection_reason: entry.rejection_reason,
    rejection_undo_snapshot: snapshot,
    updated_at: new Date().toISOString(),
  };
}
