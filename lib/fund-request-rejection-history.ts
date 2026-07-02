import type {
  FundRequestRejectionHistoryEntry,
  FundRequestRow,
} from "@/types/fund-request";

export type { FundRequestRejectionHistoryEntry };

function parseRejectionHistory(
  value: FundRequestRow["rejection_history"] | unknown
): FundRequestRejectionHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is FundRequestRejectionHistoryEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as FundRequestRejectionHistoryEntry).rejected_by === "string" &&
      typeof (entry as FundRequestRejectionHistoryEntry).rejected_at === "string"
  );
}

export function getFundRequestRejectionHistory(
  request: Pick<FundRequestRow, "rejection_history">
): FundRequestRejectionHistoryEntry[] {
  return parseRejectionHistory(request.rejection_history);
}

export function getActiveFundRequestRejection(
  request: Pick<FundRequestRow, "rejection_history" | "status" | "rejected_by" | "rejected_at" | "rejection_reason">
): FundRequestRejectionHistoryEntry | null {
  const history = getFundRequestRejectionHistory(request);
  const activeFromHistory = [...history]
    .reverse()
    .find((entry) => !entry.undone_at);
  if (activeFromHistory) return activeFromHistory;

  if (request.status !== "rejected" || !request.rejected_by || !request.rejected_at) {
    return null;
  }

  return {
    rejected_by: request.rejected_by,
    rejected_at: request.rejected_at,
    rejection_reason: request.rejection_reason,
    undone_at: null,
    undone_by: null,
  };
}

export function appendFundRequestRejectionHistory(
  history: FundRequestRow["rejection_history"] | unknown,
  entry: Omit<FundRequestRejectionHistoryEntry, "undone_at" | "undone_by">
): FundRequestRejectionHistoryEntry[] {
  return [
    ...parseRejectionHistory(history),
    {
      ...entry,
      undone_at: null,
      undone_by: null,
    },
  ];
}

export function markLatestFundRequestRejectionUndone(
  history: FundRequestRow["rejection_history"] | unknown,
  undoneBy: string,
  undoneAt: string
): FundRequestRejectionHistoryEntry[] {
  const entries = parseRejectionHistory(history);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (!entries[index]?.undone_at) {
      entries[index] = {
        ...entries[index],
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
  entry: FundRequestRejectionHistoryEntry
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
