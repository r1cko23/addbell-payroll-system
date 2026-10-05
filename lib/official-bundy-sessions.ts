import { getBundyBusinessDayKey } from "@/lib/bundy-business-day";

type SessionLike = {
  id: string;
  clock_in_time: string;
  clock_out_time?: string | null;
};

function completeDurationMs(s: SessionLike): number {
  if (!s.clock_out_time) return 0;
  const start = new Date(s.clock_in_time).getTime();
  const end = new Date(s.clock_out_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return end - start;
}

function isLongerOfficialComplete(candidate: SessionLike, current: SessionLike): boolean {
  const candidateMs = completeDurationMs(candidate);
  const currentMs = completeDurationMs(current);
  if (candidateMs !== currentMs) return candidateMs > currentMs;
  return (
    new Date(candidate.clock_in_time).getTime() <
    new Date(current.clock_in_time).getTime()
  );
}

/**
 * Keeps one official Time In/Out pair per Bundy business day: the longest complete
 * session. Accidental ~1-minute in/out must not hide a real overnight shift.
 * Extra shorter pairs (without OT/FTL filing) are excluded from attendance and payroll.
 */
export function filterOfficialBundySessions<T extends SessionLike>(
  sessions: T[],
  getBizKey: (session: T) => string = (s) => getBundyBusinessDayKey(s.clock_in_time)
): T[] {
  const officialCompleteByBizDay = new Map<string, T>();
  const earliestIncompleteByBizDay = new Map<string, T>();

  for (const s of sessions) {
    const bizKey = getBizKey(s);
    if (s.clock_out_time) {
      const existing = officialCompleteByBizDay.get(bizKey);
      if (!existing || isLongerOfficialComplete(s, existing)) {
        officialCompleteByBizDay.set(bizKey, s);
      }
    } else {
      const existing = earliestIncompleteByBizDay.get(bizKey);
      if (
        !existing ||
        new Date(s.clock_in_time).getTime() <
          new Date(existing.clock_in_time).getTime()
      ) {
        earliestIncompleteByBizDay.set(bizKey, s);
      }
    }
  }

  const officialCompleteIds = new Set(
    [...officialCompleteByBizDay.values()].map((s) => s.id)
  );

  return sessions.filter((s) => {
    if (s.clock_out_time) {
      return officialCompleteIds.has(s.id);
    }
    const bizKey = getBizKey(s);
    if (officialCompleteByBizDay.has(bizKey)) return false;
    return earliestIncompleteByBizDay.get(bizKey)?.id === s.id;
  });
}
