/**
 * Unified cutoff attendance pipeline (Frappe HR Auto Attendance → Attendance pattern).
 *
 * Clock sessions → timesheet generator → SIL leave overlay → payslip day merge.
 * All payroll surfaces should call this instead of duplicating the three steps.
 */

import {
  generateTimesheetFromClockEntries,
  type TimeClockEntry,
} from "@/lib/timesheet-auto-generator";
import {
  mapPayslipAttendanceDays,
  type MappedPayslipAttendanceDay,
} from "@/lib/map-payslip-attendance-days";
import type { DailyAttendance } from "@/utils/payroll-calculator";
import {
  applyLeaveOverlayToAttendance,
  type LeaveDayInfo,
} from "./leave-overlay";
import { sumAttendanceRegularHours } from "./attendance-cutoff";
import type { HolidayForCutoff } from "./types";

export type BuildCutoffAttendanceInput = {
  clockEntries: TimeClockEntry[];
  periodStart: Date;
  periodEnd: Date;
  holidays: HolidayForCutoff[];
  restDays?: Map<string, boolean>;
  leaveDatesMap?: Map<string, LeaveDayInfo>;
  approvedOTByDate?: Map<string, number>;
  approvedNDByDate?: Map<string, number>;
  isClientBased?: boolean;
  isClientBasedAccountSupervisor?: boolean;
  eligibleForOT?: boolean;
  eligibleForNightDiff?: boolean;
  /** Sessions used for clock merge on payslip days (period-only is typical). */
  clockEntriesForMap?: TimeClockEntry[];
};

export type CutoffAttendanceResult = {
  attendance_data: MappedPayslipAttendanceDay[];
  generator_attendance_data: DailyAttendance[];
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
};

function prepareClockEntriesForGenerator(
  entries: TimeClockEntry[]
): TimeClockEntry[] {
  return entries.map((entry) => ({
    ...entry,
    overtime_hours: 0,
    total_night_diff_hours:
      typeof entry.total_night_diff_hours === "number"
        ? entry.total_night_diff_hours
        : 0,
  }));
}

function clockEntriesForPayslipMap(
  entries: TimeClockEntry[]
): Array<{
  clock_in_time?: string | null;
  clock_out_time?: string | null;
  regular_hours?: number | null;
}> {
  return entries.map((entry) => ({
    clock_in_time: entry.clock_in_time,
    clock_out_time: entry.clock_out_time,
    regular_hours:
      entry.regular_hours ??
      (entry as { total_hours?: number | null }).total_hours ??
      null,
  }));
}

/**
 * Build merged attendance days for a weekly cutoff from clock sessions.
 */
export function buildCutoffAttendance(
  input: BuildCutoffAttendanceInput
): CutoffAttendanceResult {
  const {
    clockEntries,
    periodStart,
    periodEnd,
    holidays,
    restDays,
    leaveDatesMap,
    approvedOTByDate,
    approvedNDByDate,
    isClientBased = false,
    isClientBasedAccountSupervisor = false,
    eligibleForOT = true,
    eligibleForNightDiff = true,
    clockEntriesForMap,
  } = input;

  const preparedEntries = prepareClockEntriesForGenerator(clockEntries);

  const timesheetData = generateTimesheetFromClockEntries(
    preparedEntries,
    periodStart,
    periodEnd,
    holidays,
    restDays,
    eligibleForOT,
    eligibleForNightDiff,
    isClientBasedAccountSupervisor,
    approvedOTByDate,
    approvedNDByDate,
    isClientBased
  );

  let generatorDays = timesheetData.attendance_data as DailyAttendance[];

  if (leaveDatesMap && leaveDatesMap.size > 0) {
    generatorDays = applyLeaveOverlayToAttendance(
      generatorDays,
      leaveDatesMap
    ) as DailyAttendance[];
  }

  const mapSource = clockEntriesForMap ?? clockEntries;
  const attendance_data = mapPayslipAttendanceDays(
    generatorDays,
    clockEntriesForPayslipMap(mapSource)
  );

  const total_regular_hours = sumAttendanceRegularHours(attendance_data);
  const total_overtime_hours =
    Math.round(
      attendance_data.reduce((sum, d) => sum + Number(d.overtimeHours || 0), 0) *
        100
    ) / 100;
  const total_night_diff_hours =
    Math.round(
      attendance_data.reduce((sum, d) => sum + Number(d.nightDiffHours || 0), 0) *
        100
    ) / 100;

  return {
    attendance_data,
    generator_attendance_data: generatorDays,
    total_regular_hours,
    total_overtime_hours,
    total_night_diff_hours,
  };
}
