import { parseISO } from "date-fns";
import { creditWorkHoursHalfHour } from "@/utils/overtime";

/**
 * Company business hours policy (Asia/Manila local time).
 *
 * Compressed schedule:
 * - Monday to Thursday: 07:00-18:00 (with 12:00-13:00 unpaid lunch)
 * - Friday: 07:00-16:00 (with 12:00-13:00 unpaid lunch)
 *
 * Saturday is not a required in-office day, but attendance can still be recorded.
 */

export interface TimeWindow {
  startHour: number;
  endHour: number;
}

export interface BusinessDayPolicy {
  requiresOffice: boolean;
  shouldRecordAttendance: boolean;
  windows: TimeWindow[];
}

export const BUSINESS_WINDOW_HOURS = 4;
export const BUSINESS_HOURS_GRACE_MINUTES = 5;
export const LATE_GRACE_MINUTES = 15;

export function calculateLateHours(
  scheduledStartMinutes: number,
  actualInMinutes: number,
  graceMinutes: number = LATE_GRACE_MINUTES
): number {
  const lateMinutes = actualInMinutes - scheduledStartMinutes;
  if (!Number.isFinite(lateMinutes) || lateMinutes <= graceMinutes) return 0;
  // Bucket by hours with a grace window per hour:
  // - 7:16–8:15 => 1 hour late
  // - 8:16–9:15 => 2 hours late
  // - 9:16–10:15 => 3 hours late
  // Formula: ceil((lateMinutes - graceMinutes) / 60)
  return Math.ceil((lateMinutes - graceMinutes) / 60);
}

const REQUIRED_WEEKDAY_WINDOWS: TimeWindow[] = [
  { startHour: 7, endHour: 12 },
  { startHour: 13, endHour: 18 },
];

const FRIDAY_WINDOWS: TimeWindow[] = [
  { startHour: 7, endHour: 12 },
  { startHour: 13, endHour: 16 },
];

// Kept for optional attendance logging on Saturdays.
const SATURDAY_RECORDING_WINDOWS: TimeWindow[] = [
  { startHour: 8, endHour: 12 },
  { startHour: 13, endHour: 17 },
];

export function getBusinessDayPolicyByDay(dayOfWeek: number): BusinessDayPolicy {
  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    return {
      requiresOffice: true,
      shouldRecordAttendance: true,
      windows: REQUIRED_WEEKDAY_WINDOWS,
    };
  }

  if (dayOfWeek === 5) {
    return {
      requiresOffice: true,
      shouldRecordAttendance: true,
      windows: FRIDAY_WINDOWS,
    };
  }

  if (dayOfWeek === 6) {
    return {
      requiresOffice: false,
      shouldRecordAttendance: true,
      windows: SATURDAY_RECORDING_WINDOWS,
    };
  }

  return {
    requiresOffice: false,
    shouldRecordAttendance: true,
    windows: [],
  };
}

export function getBusinessDayPolicy(date: Date): BusinessDayPolicy {
  return getBusinessDayPolicyByDay(date.getDay());
}

export function getBusinessStartHourByDay(dayOfWeek: number): number | null {
  const policy = getBusinessDayPolicyByDay(dayOfWeek);
  if (!policy.windows.length) return null;
  return policy.windows[0].startHour;
}

export function getBusinessStartHour(date: Date): number | null {
  return getBusinessStartHourByDay(date.getDay());
}

export function formatHourLabel24(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 NN";
  return `${hour - 12}:00 PM`;
}

/**
 * Parse a clock string as an instant in Asia/Manila when no offset is present.
 * Matches timesheet / payslip Bundy handling for naive DB timestamps.
 */
export function parseTimestampInManila(value: string): Date {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    return parseISO(value);
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(`${normalized}+08:00`);
}

/** yyyy-MM-dd for the Asia/Manila calendar day of this instant (from ISO wall time). */
export function getManilaDateKeyFromIso(iso: string): string {
  const date = parseTimestampInManila(iso);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/** Clock face in Asia/Manila for an ISO timestamp (uses same naive→+08:00 rules as `parseTimestampInManila`). */
export function getManilaHourMinute(isoTimestamp: string): { hour: number; minute: number } {
  const date = parseTimestampInManila(isoTimestamp);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return { hour, minute };
}

/** Sun=0 … Sat=6 for a **calendar** yyyy-MM-dd (not parseISO midnight — host-TZ safe). */
export function calendarDowFromManilaKey(manilaYyyyMmDd: string): number {
  const segs = manilaYyyyMmDd.split("-").map((x) => parseInt(x, 10));
  if (segs.length !== 3 || segs.some((n) => !Number.isFinite(n))) return 0;
  const [y, mo, d] = segs;
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
}

/**
 * Regular (BH) hours for one Bundy in/out pair: overlap with scheduled windows in Manila
 * (unpaid lunch excluded via split windows). No fixed 8h cap — Mon–Thu can credit up to ~10h.
 * Sunday (no policy windows): 0. Same math as `generateTimesheetFromClockEntries`.
 */
export function regularHoursFromBundyClockPair(
  clockInISO: string,
  clockOutISO: string
): number {
  const clockIn = parseTimestampInManila(clockInISO);
  const clockOut = parseTimestampInManila(clockOutISO);
  if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())) return 0;
  if (clockOut <= clockIn) return 0;

  const manilaDate = getManilaDateKeyFromIso(clockInISO);
  if (!manilaDate) return 0;

  const dayOfWeek = calendarDowFromManilaKey(manilaDate);
  const dayPolicy = getBusinessDayPolicyByDay(dayOfWeek);
  if (dayPolicy.windows.length === 0) return 0;

  const overlapHours = (startA: Date, endA: Date, startB: Date, endB: Date) => {
    const start = Math.max(startA.getTime(), startB.getTime());
    const end = Math.min(endA.getTime(), endB.getTime());
    if (end <= start) return 0;
    return (end - start) / (1000 * 60 * 60);
  };

  const windowStarts = dayPolicy.windows.map(
    (w) => new Date(`${manilaDate}T${String(w.startHour).padStart(2, "0")}:00:00+08:00`)
  );
  const windowEnds = dayPolicy.windows.map(
    (w) => new Date(`${manilaDate}T${String(w.endHour).padStart(2, "0")}:00:00+08:00`)
  );

  const dayStart = windowStarts[0];
  const dayEnd = windowEnds[windowEnds.length - 1];
  let adjustedClockIn = clockIn;
  let adjustedClockOut = clockOut;

  // Clock-in: use the same grace as `calculateLateHours` (LT) so a 7:07 start is not
  // both "0h late" and a full hour of UT after BH is floored vs 10h required Mon–Thu.
  if (
    adjustedClockIn > dayStart &&
    adjustedClockIn.getTime() <= dayStart.getTime() + LATE_GRACE_MINUTES * 60 * 1000
  ) {
    adjustedClockIn = dayStart;
  }
  if (
    adjustedClockOut < dayEnd &&
    adjustedClockOut.getTime() >=
      dayEnd.getTime() - BUSINESS_HOURS_GRACE_MINUTES * 60 * 1000
  ) {
    adjustedClockOut = dayEnd;
  }

  const raw = dayPolicy.windows.reduce((sum, _window, idx) => {
    const start = windowStarts[idx];
    const end = windowEnds[idx];
    return sum + overlapHours(adjustedClockIn, adjustedClockOut, start, end);
  }, 0);
  return creditWorkHoursHalfHour(Math.round(raw * 100) / 100);
}

export function calculateHoursWithinWindows(
  clockIn: Date,
  clockOut: Date,
  workDate: Date,
  windows: TimeWindow[],
  graceMinutes: number = BUSINESS_HOURS_GRACE_MINUTES
): number {
  if (clockOut <= clockIn || windows.length === 0) return 0;

  const overlapHours = (startA: Date, endA: Date, startB: Date, endB: Date) => {
    const start = Math.max(startA.getTime(), startB.getTime());
    const end = Math.min(endA.getTime(), endB.getTime());
    if (end <= start) return 0;
    return (end - start) / (1000 * 60 * 60);
  };

  const dayStart = new Date(workDate);
  dayStart.setHours(windows[0].startHour, 0, 0, 0);
  const dayEnd = new Date(workDate);
  dayEnd.setHours(windows[windows.length - 1].endHour, 0, 0, 0);

  let adjustedClockIn = clockIn;
  let adjustedClockOut = clockOut;

  // Allow a short grace period before counting late/undertime deductions in paid hours.
  if (
    graceMinutes > 0 &&
    adjustedClockIn > dayStart &&
    adjustedClockIn.getTime() <= dayStart.getTime() + graceMinutes * 60 * 1000
  ) {
    adjustedClockIn = dayStart;
  }
  if (
    graceMinutes > 0 &&
    adjustedClockOut < dayEnd &&
    adjustedClockOut.getTime() >= dayEnd.getTime() - graceMinutes * 60 * 1000
  ) {
    adjustedClockOut = dayEnd;
  }

  return windows.reduce((sum, window) => {
    const start = new Date(workDate);
    start.setHours(window.startHour, 0, 0, 0);
    const end = new Date(workDate);
    end.setHours(window.endHour, 0, 0, 0);
    return sum + overlapHours(adjustedClockIn, adjustedClockOut, start, end);
  }, 0);
}
