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
