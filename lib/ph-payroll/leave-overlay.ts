/**
 * Approved leave → attendance overlay (SIL credits working hours).
 * Shared by payslips, auto-generate, and bulk payroll paths.
 */

import { format, addDays, parseISO } from "date-fns";

export interface LeaveDayInfo {
  leaveType: string;
  status: string;
  isHalfDay?: boolean;
}

export type LeaveRequestRow = {
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  selected_dates?: string[] | null;
  half_day_dates?: string[] | null;
};

export function buildLeaveDatesMap(
  leaveData: LeaveRequestRow[],
  periodStartStr: string,
  periodEndStr: string
): Map<string, LeaveDayInfo> {
  const leaveDatesMap = new Map<string, LeaveDayInfo>();

  for (const leave of leaveData) {
    const halfDayDatesSet = new Set<string>();
    if (leave.half_day_dates && Array.isArray(leave.half_day_dates)) {
      leave.half_day_dates.forEach((dateStr) => halfDayDatesSet.add(dateStr));
    }

    const addDate = (dateStr: string) => {
      if (dateStr < periodStartStr || dateStr > periodEndStr) return;
      const existing = leaveDatesMap.get(dateStr);
      if (!existing || leave.leave_type === "SIL") {
        leaveDatesMap.set(dateStr, {
          leaveType: leave.leave_type,
          status: leave.status,
          isHalfDay: halfDayDatesSet.has(dateStr),
        });
      }
    };

    if (leave.selected_dates && Array.isArray(leave.selected_dates)) {
      leave.selected_dates.forEach(addDate);
    } else {
      let currentDate = parseISO(leave.start_date);
      const endDate = parseISO(leave.end_date);
      while (currentDate <= endDate) {
        addDate(format(currentDate, "yyyy-MM-dd"));
        currentDate = addDays(currentDate, 1);
      }
    }
  }

  return leaveDatesMap;
}

/** SIL dates that should count as present for base-pay absence detection. */
export function getSilCreditedDates(
  leaveDatesMap: Map<string, LeaveDayInfo>
): Set<string> {
  const credited = new Set<string>();
  leaveDatesMap.forEach((info, dateStr) => {
    if (info.leaveType === "SIL") credited.add(dateStr);
  });
  return credited;
}

export function applyLeaveOverlayToAttendance<
  T extends { date?: string; regularHours?: number; dayType?: string },
>(
  attendanceData: T[],
  leaveDatesMap: Map<string, LeaveDayInfo>
): T[] {
  return attendanceData.map((day) => {
    const leaveInfo = leaveDatesMap.get(String(day.date ?? ""));
    if (!leaveInfo || leaveInfo.leaveType !== "SIL") return day;

    const silHours = leaveInfo.isHalfDay ? 4 : 8;
    return {
      ...day,
      regularHours: silHours,
      dayType: "regular",
    };
  });
}
