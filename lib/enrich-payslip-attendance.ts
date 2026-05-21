import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchProjectTimeSessionsForEmployee,
  fetchSessionsForEmployee,
  mergeBundyAndFtlClockSessions,
} from "@/lib/timeEntries";
import {
  buildStoredEarningsBreakdown,
  normalizeEarningsBreakdownForExport,
  regularHoursBasicGross,
  resolveGrossPayForDisplay,
} from "@/lib/payroll-earnings-breakdown";
import { mapPayslipAttendanceDays } from "@/lib/map-payslip-attendance-days";
import { ratePerDayAndHourFromProfile } from "@/lib/payslip-display";

function getDateInManila(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }-${parts.find((p) => p.type === "day")?.value}`;
}

/** Merge live clock sessions into saved payslip attendance (same rules as Payslips page). */
export async function enrichPayslipAttendanceFromClock(
  admin: SupabaseClient,
  params: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    earningsBreakdown: unknown;
    salaryBasis?: string | null;
    baseRate?: number | null;
  }
) {
  const normalized = normalizeEarningsBreakdownForExport(params.earningsBreakdown);
  const rawDays = normalized?.attendance_data ?? [];

  const startWide = new Date(`${params.periodStart}T00:00:00+08:00`);
  startWide.setDate(startWide.getDate() - 1);
  const endWide = new Date(`${params.periodEnd}T23:59:59+08:00`);
  endWide.setDate(endWide.getDate() + 1);

  const [mainSessions, projectSessions] = await Promise.all([
    fetchSessionsForEmployee(
      admin,
      params.employeeId,
      startWide.toISOString(),
      endWide.toISOString(),
      getDateInManila
    ),
    fetchProjectTimeSessionsForEmployee(
      admin,
      params.employeeId,
      startWide.toISOString(),
      endWide.toISOString(),
      getDateInManila
    ),
  ]);

  const sessions = mergeBundyAndFtlClockSessions(
    [...(mainSessions || []), ...(projectSessions || [])],
    [],
    getDateInManila,
    null
  ).filter((entry: any) => {
    const dateStr = entry.clock_in_date_ph || getDateInManila(entry.clock_in_time);
    return dateStr >= params.periodStart && dateStr <= params.periodEnd;
  });

  const clockForMap = sessions.map((s: any) => ({
    clock_in_time: s.clock_in_time,
    clock_out_time: s.clock_out_time,
    regular_hours: s.regular_hours ?? s.total_hours ?? null,
  }));

  const attendance_data = mapPayslipAttendanceDays(rawDays, clockForMap);
  const { perHour } = ratePerDayAndHourFromProfile({
    employee_id: params.employeeId,
    full_name: "",
    salary_basis: params.salaryBasis,
    base_rate: params.baseRate,
  });

  const payroll_result =
    perHour > 0 && attendance_data.length > 0
      ? buildStoredEarningsBreakdown(attendance_data, perHour).payroll_result
      : normalized?.payroll_result ?? null;

  const basicGross = regularHoursBasicGross(attendance_data, perHour);
  const payrollGross = payroll_result?.grossPay ?? 0;
  const gross_pay = resolveGrossPayForDisplay({
    previewGrossPay: Math.max(basicGross, payrollGross),
    attendanceData: attendance_data,
    ratePerHour: perHour,
  });

  return {
    attendance_data,
    payroll_result,
    gross_pay,
    rate_per_hour: perHour,
  };
}
