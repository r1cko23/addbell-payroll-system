import {
  listCompletedBundySessions,
  sessionPairKey,
  type BundyCompletedSession,
} from "@/lib/bundy-sessions";
import type { TimeEntryPunch } from "@/lib/timeEntries";

/** Validates that a completed Bundy in/out pair exists and is not already used on another OT. */
export function validateBundyOtSessionPair(params: {
  punches: TimeEntryPunch[];
  inPunchId: string;
  outPunchId: string;
  usedPairKeys?: Set<string>;
}): { session: BundyCompletedSession } | { error: string } {
  const sessions = listCompletedBundySessions(params.punches, {
    excludePairsUsedByOt: params.usedPairKeys,
    excludeFirstSessionPerBusinessDay: false,
  });
  const match = sessions.find(
    (s) =>
      s.in_punch_id === params.inPunchId && s.out_punch_id === params.outPunchId
  );
  if (!match) {
    return {
      error:
        "Selected time in/out pair was not found or is already linked to another OT request.",
    };
  }
  return { session: match };
}

export function buildUsedOtPairKeys(
  rows: Array<{
    bundy_in_punch_id?: string | null;
    bundy_out_punch_id?: string | null;
    status?: string;
  }>
): Set<string> {
  const used = new Set<string>();
  rows.forEach((r) => {
    if (r.status === "rejected") return;
    if (r.bundy_in_punch_id && r.bundy_out_punch_id) {
      used.add(sessionPairKey(r.bundy_in_punch_id, r.bundy_out_punch_id));
    }
  });
  return used;
}
