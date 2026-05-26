import { getBundyBusinessDayKey } from "@/lib/bundy-business-day";
import {
  getDateInManilaDefault,
  punchesToSessions,
  type TimeEntryPunch,
  type TimeEntrySession,
} from "@/lib/timeEntries";

export type BundyCompletedSession = {
  in_punch_id: string;
  out_punch_id: string;
  clock_in_time: string;
  clock_out_time: string;
  business_day_key: string;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  total_hours: number;
};

function punchMap(punches: TimeEntryPunch[]): Map<string, TimeEntryPunch> {
  return new Map(punches.map((p) => [p.id, p]));
}

export function listCompletedBundySessions(
  punches: TimeEntryPunch[],
  options?: {
    businessDayKey?: string;
    excludePairsUsedByOt?: Set<string>;
  }
): BundyCompletedSession[] {
  const sessions = punchesToSessions(
    [...punches].sort(
      (a, b) =>
        new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
    ),
    getDateInManilaDefault
  );

  const byId = punchMap(punches);
  const out: BundyCompletedSession[] = [];

  sessions.forEach((s: TimeEntrySession) => {
    if (!s.clock_out_time || !s.out_punch_id) return;
    const businessDay = getBundyBusinessDayKey(s.clock_in_time);
    if (
      options?.businessDayKey &&
      businessDay !== options.businessDayKey
    ) {
      return;
    }
    const pairKey = `${s.id}::${s.out_punch_id}`;
    if (options?.excludePairsUsedByOt?.has(pairKey)) return;

    const inPunch = byId.get(s.id);
    const outPunch = byId.get(s.out_punch_id);

    const totalHours =
      s.total_hours ??
      Math.round(
        ((new Date(s.clock_out_time).getTime() -
          new Date(s.clock_in_time).getTime()) /
          (1000 * 60 * 60)) *
          100
      ) / 100;

    out.push({
      in_punch_id: s.id,
      out_punch_id: s.out_punch_id,
      clock_in_time: s.clock_in_time,
      clock_out_time: s.clock_out_time,
      business_day_key: businessDay,
      clock_in_lat: inPunch?.lat ?? null,
      clock_in_lng: inPunch?.lng ?? null,
      clock_out_lat: outPunch?.lat ?? null,
      clock_out_lng: outPunch?.lng ?? null,
      total_hours: totalHours,
    });
  });

  return out.sort(
    (a, b) =>
      new Date(b.clock_in_time).getTime() - new Date(a.clock_in_time).getTime()
  );
}

export function sessionPairKey(inId: string, outId: string): string {
  return `${inId}::${outId}`;
}

/** Manila HH:mm from ISO */
export function manilaTimeFromIso(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

export function manilaDateFromIso(iso: string): string {
  return getDateInManilaDefault(iso);
}
