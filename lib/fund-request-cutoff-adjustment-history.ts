import type {
  FundRequestCutoffAdjustmentEntry,
  FundRequestRow,
} from "@/types/fund-request";

function parseCutoffAdjustmentHistory(
  value: FundRequestRow["cutoff_adjustment_history"] | unknown
): FundRequestCutoffAdjustmentEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is FundRequestCutoffAdjustmentEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as FundRequestCutoffAdjustmentEntry).moved_by === "string" &&
      typeof (entry as FundRequestCutoffAdjustmentEntry).moved_at === "string" &&
      typeof (entry as FundRequestCutoffAdjustmentEntry).from_cutoff_start_ymd ===
        "string" &&
      typeof (entry as FundRequestCutoffAdjustmentEntry).to_cutoff_start_ymd === "string" &&
      typeof (entry as FundRequestCutoffAdjustmentEntry).from_created_at === "string" &&
      typeof (entry as FundRequestCutoffAdjustmentEntry).to_created_at === "string"
  );
}

export function getFundRequestCutoffAdjustmentHistory(
  request: Pick<FundRequestRow, "cutoff_adjustment_history">
): FundRequestCutoffAdjustmentEntry[] {
  return parseCutoffAdjustmentHistory(request.cutoff_adjustment_history);
}

export function getActiveFundRequestCutoffAdjustment(
  request: Pick<FundRequestRow, "cutoff_adjustment_history" | "created_at">
): FundRequestCutoffAdjustmentEntry | null {
  const history = getFundRequestCutoffAdjustmentHistory(request);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (!entry?.undone_at) {
      if (entry.to_created_at === request.created_at) {
        return entry;
      }
      return null;
    }
  }
  return null;
}

export function appendFundRequestCutoffAdjustmentHistory(
  history: FundRequestRow["cutoff_adjustment_history"] | unknown,
  entry: FundRequestCutoffAdjustmentEntry
): FundRequestCutoffAdjustmentEntry[] {
  return [
    ...parseCutoffAdjustmentHistory(history),
    {
      ...entry,
      undone_at: entry.undone_at ?? null,
      undone_by: entry.undone_by ?? null,
    },
  ];
}

export function markLatestFundRequestCutoffAdjustmentUndone(
  history: FundRequestRow["cutoff_adjustment_history"] | unknown,
  undoneBy: string,
  undoneAt: string
): FundRequestCutoffAdjustmentEntry[] {
  const entries = parseCutoffAdjustmentHistory(history);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry?.undone_at) {
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
