import { format, parseISO } from "date-fns";

export type OtRequestLike = {
  ot_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  status?: string | null;
  total_hours?: number | null;
};

function isApprovedOtStatus(st?: string | null): boolean {
  return (
    st === "approved" ||
    st === "approved_by_manager" ||
    st === "approved_by_hr"
  );
}

/** HH:mm:ss from DB time field (ISO or time-only). */
export function extractTimePortion(time: string): string | null {
  if (!time) return null;
  const raw = time.includes("T")
    ? time.split("T")[1].split(".")[0].split("+")[0].split("Z")[0]
    : time;
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const h = m[1].padStart(2, "0");
  const min = m[2].padStart(2, "0");
  const s = (m[3] ?? "00").padStart(2, "0");
  return `${h}:${min}:${s}`;
}

/**
 * When approved FTL documents clock-in but not clock-out, use the latest
 * approved OT end on the same calendar ot_date as a synthetic clock-out (Manila +08).
 */
export function syntheticClockOutFromApprovedOt(
  clockInIso: string,
  dateKey: string,
  otRequests: OtRequestLike[]
): string | null {
  const clockIn = parseISO(clockInIso);
  if (Number.isNaN(clockIn.getTime())) return null;

  let best: Date | null = null;

  for (const ot of otRequests) {
    if (ot.status != null && !isApprovedOtStatus(ot.status)) continue;

    const otDateStr =
      typeof ot.ot_date === "string"
        ? ot.ot_date.split("T")[0]
        : format(new Date(ot.ot_date), "yyyy-MM-dd");
    if (otDateStr !== dateKey) continue;

    const endDateStr = ot.end_date
      ? typeof ot.end_date === "string"
        ? ot.end_date.split("T")[0]
        : format(new Date(ot.end_date), "yyyy-MM-dd")
      : otDateStr;

    const timePortion = extractTimePortion(ot.end_time);
    if (!timePortion) continue;

    const endIso = `${endDateStr}T${timePortion}+08:00`;
    const endDt = parseISO(endIso);
    if (Number.isNaN(endDt.getTime()) || endDt <= clockIn) continue;

    if (!best || endDt > best) best = endDt;
  }

  return best ? best.toISOString() : null;
}

/** FTL pair keyed as `${employee_id}::${yyyy-MM-dd}` (missed_date). */
export type FtlEmployeeDatePair = {
  inTime: string | null;
  outTime: string | null;
  sourceId?: string;
};

export type OtRowWithEmployee = OtRequestLike & { employee_id: string };

/**
 * For each map entry with clock-in but no clock-out, sets `outTime` from approved OT end
 * on the same ot_date when {@link syntheticClockOutFromApprovedOt} finds one.
 */
export function fillMissingFtlClockOutsFromApprovedOtByEmployeeDate(
  pairMap: Map<string, FtlEmployeeDatePair>,
  otRows: OtRowWithEmployee[]
): void {
  const rows = otRows || [];
  pairMap.forEach((pair, key) => {
    const sep = key.indexOf("::");
    if (sep < 0) return;
    const employeeId = key.slice(0, sep);
    const dateKey = key.slice(sep + 2);
    if (!pair.inTime || pair.outTime || !employeeId || !dateKey) return;
    const ots = rows.filter((r) => {
      if (r.employee_id !== employeeId) return false;
      const d = String(r.ot_date || "").split("T")[0];
      return d === dateKey;
    });
    const syn = syntheticClockOutFromApprovedOt(pair.inTime, dateKey, ots);
    if (syn) pair.outTime = syn;
  });
}
