import { getBundyBusinessDayKey } from "@/lib/bundy-business-day";

type SessionLike = {
  id: string;
  clock_in_time: string;
  clock_out_time?: string | null;
};

/**
 * Keeps only the first official Time In/Out pair per Bundy business day.
 * Extra pairs (without OT/FTL filing) are excluded from attendance and payroll.
 */
export function filterOfficialBundySessions<T extends SessionLike>(
  sessions: T[],
  getBizKey: (session: T) => string = (s) => getBundyBusinessDayKey(s.clock_in_time)
): T[] {
  const earliestCompleteByBizDay = new Map<string, T>();
  const earliestIncompleteByBizDay = new Map<string, T>();

  for (const s of sessions) {
    const bizKey = getBizKey(s);
    if (s.clock_out_time) {
      const existing = earliestCompleteByBizDay.get(bizKey);
      if (
        !existing ||
        new Date(s.clock_in_time).getTime() <
          new Date(existing.clock_in_time).getTime()
      ) {
        earliestCompleteByBizDay.set(bizKey, s);
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
    [...earliestCompleteByBizDay.values()].map((s) => s.id)
  );

  return sessions.filter((s) => {
    if (s.clock_out_time) {
      return officialCompleteIds.has(s.id);
    }
    const bizKey = getBizKey(s);
    if (earliestCompleteByBizDay.has(bizKey)) return false;
    return earliestIncompleteByBizDay.get(bizKey)?.id === s.id;
  });
}
