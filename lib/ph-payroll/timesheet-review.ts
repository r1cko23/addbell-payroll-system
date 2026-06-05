/**
 * Timesheet review / finalize gate (Frappe HR: lock attendance before payroll).
 */

export type TimesheetReviewStatus = "missing" | "draft" | "finalized";

export type WeeklyAttendanceRow = {
  id?: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  status?: string | null;
  total_regular_hours?: number | null;
  total_overtime_hours?: number | null;
  total_night_diff_hours?: number | null;
  gross_pay?: number | null;
  finalized_at?: string | null;
};

export function resolveTimesheetReviewStatus(
  record: Pick<WeeklyAttendanceRow, "status"> | null | undefined
): TimesheetReviewStatus {
  if (!record) return "missing";
  if (record.status === "finalized") return "finalized";
  return "draft";
}

export function canGeneratePayslipForTimesheet(
  record: Pick<WeeklyAttendanceRow, "status"> | null | undefined,
  options?: { forceOverride?: boolean }
): { allowed: boolean; reason?: string } {
  if (options?.forceOverride) {
    return { allowed: true };
  }
  if (!record) {
    return { allowed: false, reason: "No weekly attendance record for this cutoff" };
  }
  if (record.status !== "finalized") {
    return { allowed: false, reason: "Timesheet not finalized" };
  }
  return { allowed: true };
}

export type TimesheetReadinessSummary = {
  total: number;
  missing: number;
  draft: number;
  finalized: number;
};

export function summarizeTimesheetReadiness(
  statuses: TimesheetReviewStatus[]
): TimesheetReadinessSummary {
  return statuses.reduce(
    (acc, status) => {
      acc.total += 1;
      acc[status] += 1;
      return acc;
    },
    { total: 0, missing: 0, draft: 0, finalized: 0 }
  );
}
