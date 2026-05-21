import { creditWorkHoursHalfHour } from "@/utils/overtime";
import type { DayType } from "@/utils/payroll-calculator";

export type ClockEntryForPayslipMap = {
  clock_in_time?: string | null;
  clock_out_time?: string | null;
  regular_hours?: number | null;
};

export type MappedPayslipAttendanceDay = {
  date: string;
  dayType: DayType;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  clockInTime?: string;
  clockOutTime?: string;
};

function orUndefined(value: string | null | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

function manilaDateKeyFromIso(iso: string): string {
  const entryDateUTC = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(entryDateUTC);
  return `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }-${parts.find((p) => p.type === "day")?.value}`;
}

/**
 * Same rules as Payslip Generation page: merge live clock hours into attendance
 * so print preview matches the on-screen earnings breakdown.
 */
export function mapPayslipAttendanceDays(
  attendanceData: any[],
  clockEntries: ClockEntryForPayslipMap[]
): MappedPayslipAttendanceDay[] {
  if (!Array.isArray(attendanceData)) return [];

  return attendanceData.map((day: any) => {
    const dayDate = day.date || day.clock_in_time?.split("T")[0] || "";

    const matchingEntry = clockEntries.find((entry) => {
      if (!entry.clock_in_time) return false;
      return manilaDateKeyFromIso(entry.clock_in_time) === dayDate;
    });

    const isLeaveDayWithFullHours = (day.regularHours || 0) >= 8;
    const regularHours = creditWorkHoursHalfHour(
      Math.round(
        Number(
          isLeaveDayWithFullHours
            ? day.regularHours
            : matchingEntry?.regular_hours ?? day.regularHours ?? 0
        ) * 100
      ) / 100
    );

    return {
      date: dayDate,
      dayType: (day.dayType || "regular") as DayType,
      regularHours,
      overtimeHours: Number(day.overtimeHours || 0),
      nightDiffHours: Number(day.nightDiffHours || 0),
      clockInTime: orUndefined(
        matchingEntry?.clock_in_time ?? day.clockInTime ?? day.clock_in_time
      ),
      clockOutTime: orUndefined(
        matchingEntry?.clock_out_time ?? day.clockOutTime ?? day.clock_out_time
      ),
    };
  });
}
