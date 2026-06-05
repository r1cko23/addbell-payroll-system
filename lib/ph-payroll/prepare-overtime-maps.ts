/**
 * Build approved OT + ND maps for buildCutoffAttendance (shared by payslip and timesheet).
 */

import { format } from "date-fns";
import { creditNightDiffHours, creditOvertimeHours } from "@/utils/overtime";

const APPROVED_OT_STATUSES = new Set([
  "approved",
  "approved_by_manager",
  "approved_by_hr",
]);

export type OvertimeRequestForMaps = {
  ot_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  total_hours?: number | null;
  status?: string | null;
};

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function ndRawFromOtWindow(
  startTimeRaw: string,
  endTimeRaw: string,
  otDateStr: string,
  endDateRaw: string | null | undefined,
  creditedOt: number,
  ndNightStartHour: number
): number {
  const startTime = startTimeRaw.includes("T")
    ? startTimeRaw.split("T")[1]?.substring(0, 8) || startTimeRaw
    : startTimeRaw.substring(0, 8);
  const endTime = endTimeRaw.includes("T")
    ? endTimeRaw.split("T")[1]?.substring(0, 8) || endTimeRaw
    : endTimeRaw.substring(0, 8);

  const startHour = parseInt(startTime.split(":")[0], 10);
  const startMin = parseInt(startTime.split(":")[1], 10);
  const endHour = parseInt(endTime.split(":")[0], 10);
  const endMin = parseInt(endTime.split(":")[1], 10);
  if (![startHour, startMin, endHour, endMin].every(Number.isFinite)) return 0;

  const endDateStr = endDateRaw
    ? typeof endDateRaw === "string"
      ? endDateRaw.split("T")[0]
      : format(new Date(endDateRaw), "yyyy-MM-dd")
    : otDateStr;
  const spansMidnight = endDateStr !== otDateStr;

  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  const nightStartMin = ndNightStartHour * 60;
  const nightEndMin = 6 * 60;

  let ndOverlap = 0;
  if (spansMidnight) {
    const ndStartMin = Math.max(startTotalMin, nightStartMin);
    const hoursToMidnight = (24 * 60 - ndStartMin) / 60;
    const hoursFromMidnight =
      endTotalMin <= nightEndMin ? endTotalMin / 60 : nightEndMin / 60;
    ndOverlap = hoursToMidnight + hoursFromMidnight;
  } else if (startTotalMin >= nightStartMin) {
    ndOverlap = (endTotalMin - startTotalMin) / 60;
  } else if (endTotalMin >= nightStartMin) {
    ndOverlap = (endTotalMin - nightStartMin) / 60;
  }

  return Math.min(Math.max(0, ndOverlap), creditedOt);
}

export function buildApprovedOvertimeMaps(
  otRequests: OvertimeRequestForMaps[],
  options?: { ndNightStartHour?: number }
): {
  approvedOTByDate: Map<string, number>;
  approvedNDByDate: Map<string, number>;
} {
  const ndNightStartHour = options?.ndNightStartHour ?? 22;
  const approvedOTByDate = new Map<string, number>();
  const approvedNDRawByDate = new Map<string, number>();

  for (const ot of otRequests) {
    const status = normalizeStatus(ot.status);
    if (!APPROVED_OT_STATUSES.has(status)) continue;

    const dateStr =
      typeof ot.ot_date === "string"
        ? ot.ot_date.split("T")[0]
        : format(new Date(ot.ot_date), "yyyy-MM-dd");

    const credited = creditOvertimeHours(Number(ot.total_hours || 0));
    approvedOTByDate.set(dateStr, (approvedOTByDate.get(dateStr) || 0) + credited);

    if (ot.start_time && ot.end_time) {
      const ndRaw = ndRawFromOtWindow(
        ot.start_time,
        ot.end_time,
        dateStr,
        ot.end_date,
        credited,
        ndNightStartHour
      );
      if (ndRaw > 0) {
        approvedNDRawByDate.set(
          dateStr,
          Math.round(((approvedNDRawByDate.get(dateStr) || 0) + ndRaw) * 100) / 100
        );
      }
    }
  }

  const approvedNDByDate = new Map<string, number>();
  approvedNDRawByDate.forEach((raw, dateKey) => {
    const credited = creditNightDiffHours(Math.round(raw * 100) / 100);
    if (credited > 0) approvedNDByDate.set(dateKey, credited);
  });

  return { approvedOTByDate, approvedNDByDate };
}
