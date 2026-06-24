import { getDay, parseISO } from "date-fns";
import {
  calculateLateHours,
  calculateUndertimeHours,
  getBusinessDayPolicyByDay,
  regularHoursFromBundyClockPair,
  scheduledBusinessEndMinutes,
  scheduledHalfDayEndMinutes,
} from "@/utils/business-hours";
import { creditOvertimeHours, creditWorkHoursHalfHour } from "@/utils/overtime";

export type DayPunch = {
  clock_in_time: string;
  clock_out_time?: string | null;
  regular_hours?: number | null;
  total_hours?: number | null;
};

export type DayAttendanceMetrics = {
  bh: number;
  ot: number;
  lt: number;
  ut: number;
  totalWorked: number;
};

function manilaDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return getDay(new Date(y, m - 1, d));
}

function getManilaHourMinute(iso: string): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

function scheduledStartMinutes(dateStr: string): number | null {
  const policy = getBusinessDayPolicyByDay(manilaDayOfWeek(dateStr));
  if (!policy.requiresOffice || policy.windows.length === 0) return null;
  return policy.windows[0].startHour * 60;
}

export type ComputeDayAttendanceOptions = {
  /** Approved half-day leave: UT vs morning window (5h); BH credits actual worked time. */
  isHalfDayLeave?: boolean;
  /** Approved OT hours for this calendar day (required for Saturday OT credit). */
  approvedOtHours?: number;
};

/** BH / OT / Late / Undertime for one calendar day (matches Timesheet rules). */
export function computeDayAttendanceMetrics(
  dateStr: string,
  punches: DayPunch[],
  options?: ComputeDayAttendanceOptions
): DayAttendanceMetrics {
  if (!dateStr || punches.length === 0) {
    return { bh: 0, ot: 0, lt: 0, ut: 0, totalWorked: 0 };
  }

  const isSaturday = manilaDayOfWeek(dateStr) === 6;
  let worked = 0;

  punches.forEach((p) => {
    if (p.clock_in_time && p.clock_out_time) {
      worked += regularHoursFromBundyClockPair(p.clock_in_time, p.clock_out_time);
    } else {
      worked += Number(p.regular_hours ?? p.total_hours ?? 0);
    }
  });

  worked = creditWorkHoursHalfHour(Math.round(worked * 100) / 100);

  let bh = 0;
  let ot = 0;

  const dow = manilaDayOfWeek(dateStr);

  if (isSaturday) {
    // Saturday bundy punches do not auto-count as OT; only approved OT filings pay OT.
    bh = 0;
    ot = creditOvertimeHours(options?.approvedOtHours ?? 0);
  } else {
    bh = worked;
    ot = 0;
  }

  let lt = 0;
  const startMin = scheduledStartMinutes(dateStr);
  const firstIn = punches
    .map((p) => p.clock_in_time)
    .filter(Boolean)
    .sort()[0];
  if (firstIn && startMin !== null) {
    const { hour, minute } = getManilaHourMinute(firstIn);
    lt = calculateLateHours(startMin, hour * 60 + minute);
  }

  let ut = 0;
  const utEndMinutes =
    options?.isHalfDayLeave && scheduledHalfDayEndMinutes(dow) !== null
      ? scheduledHalfDayEndMinutes(dow)
      : scheduledBusinessEndMinutes(dow);
  const lastOut = punches
    .map((p) => p.clock_out_time)
    .filter((t): t is string => Boolean(t))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .pop();
  if (lastOut && utEndMinutes !== null) {
    const { hour, minute } = getManilaHourMinute(lastOut);
    ut = calculateUndertimeHours(utEndMinutes, hour * 60 + minute);
  }

  return {
    bh,
    ot,
    lt,
    ut,
    totalWorked: worked,
  };
}

/** Late / undertime totals from payslip attendance rows (uses clock in/out when present). */
export function aggregateMetricsFromAttendanceDays(
  days: Array<{
    date?: string;
    clockInTime?: string | null;
    clockOutTime?: string | null;
    clock_in_time?: string | null;
    clock_out_time?: string | null;
    regularHours?: number;
  }>
): { lateHours: number; undertimeHours: number } {
  let lateHours = 0;
  let undertimeHours = 0;
  (days || []).forEach((day) => {
    const dateStr = day.date || "";
    if (!dateStr) return;
    const clockIn = day.clockInTime ?? day.clock_in_time;
    const clockOut = day.clockOutTime ?? day.clock_out_time;
    const punches: DayPunch[] =
      clockIn && clockOut
        ? [{ clock_in_time: clockIn, clock_out_time: clockOut }]
        : [];
    const m = computeDayAttendanceMetrics(dateStr, punches);
    lateHours += m.lt;
    undertimeHours += m.ut;
  });
  return { lateHours, undertimeHours };
}

export function sumAttendanceMetrics(
  days: Array<{ metrics: DayAttendanceMetrics }>
): DayAttendanceMetrics {
  return days.reduce(
    (acc, { metrics }) => ({
      bh: acc.bh + metrics.bh,
      ot: acc.ot + metrics.ot,
      lt: acc.lt + metrics.lt,
      ut: acc.ut + metrics.ut,
      totalWorked: acc.totalWorked + metrics.totalWorked,
    }),
    {
      bh: 0,
      ot: 0,
      lt: 0,
      ut: 0,
      totalWorked: 0,
    }
  );
}
