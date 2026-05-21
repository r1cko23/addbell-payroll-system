/**
 * API Route: Auto-Generate Timesheets from Time Clock Entries
 *
 * POST /api/timesheet/auto-generate
 *
 * Body: {
 *   period_start: string (YYYY-MM-DD),
 *   period_end: string (YYYY-MM-DD),
 *   employee_ids?: string[] (optional, if not provided, generates for all active employees)
 *   overwrite_existing?: boolean (default: false)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { getBiMonthlyPeriodEnd } from "@/utils/bimonthly";
import { format } from "date-fns";
import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import { calculateMonthlySalary } from "@/utils/ph-deductions";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { fetchSessionsInRange, mergeBundyAndFtlClockSessions, getDateInManilaDefault, type TimeEntrySession } from "@/lib/timeEntries";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";
import { creditNightDiffHours, creditOvertimeHours } from "@/utils/overtime";
import {
  fillMissingFtlClockOutsFromApprovedOtByEmployeeDate,
  type OtRowWithEmployee,
} from "@/lib/ftl-ot-synthesis";

/** Raw 22:00–06:00 overlap from an approved OT window, capped by credited OT hours (no ND staircase yet). */
function approvedOtNightOverlapHoursRaw(
  startTimeRaw: string | null | undefined,
  endTimeRaw: string | null | undefined,
  otDateRaw: string | null | undefined,
  endDateRaw: string | null | undefined,
  totalHoursRaw: number | null | undefined
): number {
  if (!startTimeRaw || !endTimeRaw) return 0;
  const startTime = startTimeRaw.includes("T")
    ? startTimeRaw.split("T")[1]?.substring(0, 8) || startTimeRaw
    : startTimeRaw.substring(0, 8);
  const endTime = endTimeRaw.includes("T")
    ? endTimeRaw.split("T")[1]?.substring(0, 8) || endTimeRaw
    : endTimeRaw.substring(0, 8);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;

  const otDate = String(otDateRaw || "").split("T")[0];
  const endDate = String(endDateRaw || otDate).split("T")[0];
  const spansMidnight = Boolean(otDate && endDate && endDate !== otDate);

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nightStartMin = 22 * 60; // 10:00 PM
  const nightEndMin = 6 * 60; // 6:00 AM
  let nd = 0;

  if (spansMidnight) {
    const ndStart = Math.max(startMin, nightStartMin);
    const hoursToMidnight = (24 * 60 - ndStart) / 60;
    const hoursFromMidnight = Math.min(endMin, nightEndMin) / 60;
    nd = hoursToMidnight + hoursFromMidnight;
  } else if (startMin >= nightStartMin) {
    nd = (endMin - startMin) / 60;
  } else if (endMin >= nightStartMin) {
    nd = (endMin - nightStartMin) / 60;
  }

  const creditedOt = creditOvertimeHours(Number(totalHoursRaw || 0));
  const capped = Math.min(Math.max(0, nd), creditedOt);
  return Math.round(capped * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });

    // Check authentication and authorization
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      period_start,
      period_end,
      employee_ids,
      overwrite_existing = false,
    } = body;

    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "period_start and period_end are required" },
        { status: 400 }
      );
    }

    const periodStart = new Date(period_start);
    const periodEnd = new Date(period_end);

    const holidaysNormalized = await fetchHolidaysRange(supabase as any, {
      start: period_start,
      end: period_end,
      lookbackDays: 0,
    });

    const holidays = holidaysNormalized.map((h) => ({
      holiday_date: h.date,
      holiday_type: h.type,
    }));

    // Load employees (all active or specific ones)
    // Note: rate_per_day and rate_per_hour were removed from employees table
    // Gross pay is calculated from weekly_attendance or time clock entries
    let employeesQuery = supabase
      .from("employees")
      .select("id, employee_id, full_name, last_name, first_name, employment_type, position")
      .eq("is_active", true)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (employee_ids && employee_ids.length > 0) {
      employeesQuery = employeesQuery.in("id", employee_ids);
    }

    const { data: employees, error: empError } = await employeesQuery;

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: "No employees found" },
        { status: 404 }
      );
    }

    const results = [];
    const errors = [];

    // Batch fetch all existing timesheets for all employees at once
    const employeeIds = employees.map((e) => e.id);
    const { data: existingTimesheets } = await supabase
      .from("weekly_attendance")
      .select("id, status, employee_id")
      .in("employee_id", employeeIds)
      .eq("period_start", period_start);

    const existingTimesheetMap = new Map(
      (existingTimesheets || []).map((t) => [t.employee_id, t])
    );

    const periodStartISO = `${period_start}T00:00:00`;
    const periodEndISO = `${period_end}T23:59:59`;
    const allSessions = await fetchSessionsInRange(
      supabase,
      periodStartISO,
      periodEndISO
    );

    const { data: approvedFtlRows } = await supabase
      .from("failure_to_log")
      .select(
        "id, employee_id, missed_date, actual_clock_in_time, actual_clock_out_time, entry_type, status"
      )
      .in("employee_id", employeeIds)
      .gte("missed_date", period_start)
      .lte("missed_date", period_end)
      .eq("status", "approved");

    const { data: approvedOtRows } = await supabase
      .from("overtime_requests")
      .select("employee_id, ot_date, end_date, start_time, end_time, total_hours, status")
      .in("employee_id", employeeIds)
      .gte("ot_date", period_start)
      .lte("ot_date", period_end)
      .in("status", ["approved", "approved_by_manager", "approved_by_hr"]);

    const clockEntriesByEmployee = new Map<string, any[]>();
    allSessions.forEach((entry) => {
      const eid = entry.employee_id;
      if (!eid) return;
      if (!clockEntriesByEmployee.has(eid)) {
        clockEntriesByEmployee.set(eid, []);
      }
      clockEntriesByEmployee.get(eid)!.push(entry);
    });

    const { data: projectRowsForBundy } = await supabase
      .from("project_time_entries")
      .select("id, project_id, employee_id, clock_in, clock_out, regular_hours, total_hours")
      .in("employee_id", employeeIds)
      .gte("clock_in", periodStartISO)
      .lte("clock_in", periodEndISO)
      .not("clock_out", "is", null)
      .order("clock_in", { ascending: true });

    (projectRowsForBundy || []).forEach((r: any) => {
      const eid = r.employee_id as string | undefined;
      if (!eid || !r.clock_in || !r.clock_out) return;
      const hours = r.regular_hours ?? r.total_hours ?? 0;
      if (!clockEntriesByEmployee.has(eid)) {
        clockEntriesByEmployee.set(eid, []);
      }
      clockEntriesByEmployee.get(eid)!.push({
        id: r.id,
        clock_in_time: r.clock_in,
        clock_out_time: r.clock_out,
        clock_in_date_ph: getDateInManilaDefault(r.clock_in),
        status: "clocked_out",
        total_hours: r.total_hours ?? hours,
        regular_hours: hours,
        total_night_diff_hours: null,
        employee_id: eid,
      });
    });

    // Merge approved FTL rows as synthetic complete sessions (pairing IN+OUT by employee/date).
    const ftlPairMap = new Map<
      string,
      { inTime: string | null; outTime: string | null; sourceId: string }
    >();
    (approvedFtlRows || []).forEach((row: any) => {
      if (!row.employee_id || !row.missed_date) return;
      const dateKey = String(row.missed_date).split("T")[0];
      const key = `${row.employee_id}::${dateKey}`;
      const pair = ftlPairMap.get(key) || {
        inTime: null,
        outTime: null,
        sourceId: row.id,
      };
      if (
        (row.entry_type === "in" || row.entry_type === "both") &&
        row.actual_clock_in_time
      ) {
        pair.inTime = row.actual_clock_in_time;
      }
      if (
        (row.entry_type === "out" || row.entry_type === "both") &&
        row.actual_clock_out_time
      ) {
        pair.outTime = row.actual_clock_out_time;
      }
      pair.sourceId = pair.sourceId || row.id;
      ftlPairMap.set(key, pair);
    });

    fillMissingFtlClockOutsFromApprovedOtByEmployeeDate(
      ftlPairMap,
      (approvedOtRows || []) as OtRowWithEmployee[]
    );

    const ftlSessionsByEmployee = new Map<string, TimeEntrySession[]>();

    ftlPairMap.forEach((pair, key) => {
      if (!pair.inTime || !pair.outTime) return;
      const [employeeId] = key.split("::");
      if (!employeeId) return;
      if (new Date(pair.outTime) <= new Date(pair.inTime)) return;
      if (!ftlSessionsByEmployee.has(employeeId)) {
        ftlSessionsByEmployee.set(employeeId, []);
      }
      ftlSessionsByEmployee.get(employeeId)!.push({
        id: `ftl-${pair.sourceId}`,
        employee_id: employeeId,
        clock_in_time: pair.inTime,
        clock_out_time: pair.outTime,
        clock_in_date_ph: getDateInManilaDefault(pair.inTime),
        regular_hours: null,
        total_hours:
          Math.round(
            ((new Date(pair.outTime).getTime() - new Date(pair.inTime).getTime()) /
              (1000 * 60 * 60)) *
              100
          ) / 100,
        total_night_diff_hours: null,
        status: "approved",
      });
    });

    ftlSessionsByEmployee.forEach((ftlList, employeeId) => {
      const bundy = clockEntriesByEmployee.get(employeeId) || [];
      clockEntriesByEmployee.set(
        employeeId,
        mergeBundyAndFtlClockSessions(bundy, ftlList, getDateInManilaDefault, null)
      );
    });

    const approvedOtByEmployeeDate = new Map<string, Map<string, number>>();
    const approvedNdRawByEmployeeDate = new Map<string, Map<string, number>>();
    (approvedOtRows || []).forEach((row: any) => {
      const employeeId = row.employee_id as string | undefined;
      if (!employeeId) return;
      const dateKey = String(row.ot_date || "").split("T")[0];
      if (!dateKey) return;

      // Normalize legacy OT rows: min 1h, then 0.5 increments.
      const otHours = creditOvertimeHours(Number(row.total_hours || 0));
      const ndRaw = approvedOtNightOverlapHoursRaw(
        row.start_time,
        row.end_time,
        row.ot_date,
        row.end_date,
        row.total_hours
      );

      const otByDate = approvedOtByEmployeeDate.get(employeeId) || new Map<string, number>();
      otByDate.set(dateKey, Math.round(((otByDate.get(dateKey) || 0) + otHours) * 100) / 100);
      approvedOtByEmployeeDate.set(employeeId, otByDate);

      const ndRawByDate =
        approvedNdRawByEmployeeDate.get(employeeId) || new Map<string, number>();
      ndRawByDate.set(
        dateKey,
        Math.round(((ndRawByDate.get(dateKey) || 0) + ndRaw) * 100) / 100
      );
      approvedNdRawByEmployeeDate.set(employeeId, ndRawByDate);
    });

    const approvedNdByEmployeeDate = new Map<string, Map<string, number>>();
    approvedNdRawByEmployeeDate.forEach((ndRawMap, employeeId) => {
      const ndMap = new Map<string, number>();
      ndRawMap.forEach((raw, dateKey) => {
        const cr = creditNightDiffHours(Math.round(raw * 100) / 100);
        if (cr > 0) ndMap.set(dateKey, cr);
      });
      approvedNdByEmployeeDate.set(employeeId, ndMap);
    });

    // Batch fetch all existing timesheets for rate calculation (only for employees that need it)
    const employeesNeedingRates = employees.filter(
      (e) =>
        clockEntriesByEmployee.has(e.id) &&
        clockEntriesByEmployee.get(e.id)!.length > 0
    );
    const employeeIdsNeedingRates = employeesNeedingRates.map((e) => e.id);

    const { data: rateTimesheets } = await supabase
      .from("weekly_attendance")
      .select("employee_id, gross_pay, total_regular_hours")
      .in("employee_id", employeeIdsNeedingRates)
      .not("total_regular_hours", "is", null)
      .gt("total_regular_hours", 0)
      .order("period_start", { ascending: false });

    // Group rate timesheets by employee_id, keeping only the most recent
    const rateMap = new Map<
      string,
      { gross_pay: number; total_regular_hours: number }
    >();
    (rateTimesheets || []).forEach((ts) => {
      if (!rateMap.has(ts.employee_id)) {
        rateMap.set(ts.employee_id, {
          gross_pay: ts.gross_pay,
          total_regular_hours: ts.total_regular_hours,
        });
      }
    });

    // Process each employee (now using pre-fetched data)
    for (const employee of employees) {
      try {
        const existing = existingTimesheetMap.get(employee.id);

        if (existing && !overwrite_existing) {
          results.push({
            employee_id: employee.id,
            employee_name: employee.full_name,
            status: "skipped",
            reason: "Timesheet already exists",
          });
          continue;
        }

        const clockEntries = clockEntriesByEmployee.get(employee.id) || [];

        if (clockEntries.length === 0) {
          results.push({
            employee_id: employee.id,
            employee_name: employee.full_name,
            status: "skipped",
            reason: "No time clock entries found",
          });
          continue;
        }

        // Generate timesheet data
        // Determine employee type flags
        const isClientBased = employee.employment_type === "client-based" || false;
        const isClientBasedAccountSupervisor =
          isClientBased &&
          (employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false);

        const timesheetData = generateTimesheetFromClockEntries(
          clockEntries as any,
          periodStart,
          periodEnd,
          holidays,
          undefined, // restDays - not available in API route
          true, // eligibleForOT - default to true
          true, // eligibleForNightDiff - default to true
          isClientBasedAccountSupervisor,
          approvedOtByEmployeeDate.get(employee.id),
          approvedNdByEmployeeDate.get(employee.id),
          isClientBased // Pass client-based flag for Saturday/Sunday logic
        );

        // Calculate gross pay from attendance data
        // Use pre-fetched rate data
        let grossPay = 0;
        if (timesheetData.attendance_data.length > 0) {
          const rateData = rateMap.get(employee.id);
          let ratePerHour = 0;

          if (
            rateData &&
            rateData.total_regular_hours > 0 &&
            rateData.gross_pay > 0
          ) {
            // Estimate rate from previous timesheet
            ratePerHour = rateData.gross_pay / rateData.total_regular_hours;
          }

          // If we have a rate, calculate gross pay using payroll calculator
          if (ratePerHour > 0) {
            try {
              const payrollResult = calculateWeeklyPayroll(
                timesheetData.attendance_data,
                ratePerHour
              );
              grossPay = Math.round(payrollResult.grossPay * 100) / 100;
            } catch (calcError) {
              console.error(
                `Error calculating payroll for ${employee.full_name}:`,
                calcError
              );
              // Fallback: estimate from hours
              grossPay =
                Math.round(
                  timesheetData.total_regular_hours * ratePerHour * 100
                ) / 100;
            }
          } else {
            // No rate available - set gross pay to 0
            // The payslip generation will need to handle this case
            // or rates should be stored in a separate employee_rates table
            console.warn(
              `No rate information available for ${employee.full_name}. Gross pay set to 0.`
            );
            grossPay = 0;
          }
        }

        // Save or update timesheet - auto-finalize since timesheets are generated from approved time entries
        const now = new Date().toISOString();
        if (existing) {
          const { error: updateError } = await (
            supabase.from("weekly_attendance") as any
          )
            .update({
              attendance_data: timesheetData.attendance_data,
              total_regular_hours: timesheetData.total_regular_hours,
              total_overtime_hours: timesheetData.total_overtime_hours,
              total_night_diff_hours: timesheetData.total_night_diff_hours,
              gross_pay: grossPay,
              status: "finalized", // Auto-finalize since generated from approved time entries
              finalized_at: now,
              finalized_by: authUser.userId,
              updated_at: now,
            })
            .eq("id", existing.id);

          if (updateError) throw updateError;

          results.push({
            employee_id: employee.id,
            employee_name: employee.full_name,
            status: "updated",
            days_generated: timesheetData.attendance_data.length,
            total_regular_hours: timesheetData.total_regular_hours,
            total_overtime_hours: timesheetData.total_overtime_hours,
            total_night_diff_hours: timesheetData.total_night_diff_hours,
          });
        } else {
          const insertData = {
            employee_id: employee.id,
            period_start: period_start,
            period_end: period_end,
            period_type: "bimonthly",
            attendance_data: timesheetData.attendance_data,
            total_regular_hours: timesheetData.total_regular_hours,
            total_overtime_hours: timesheetData.total_overtime_hours,
            total_night_diff_hours: timesheetData.total_night_diff_hours,
            gross_pay: grossPay,
            status: "finalized", // Auto-finalize since generated from approved time entries
            finalized_at: now,
            finalized_by: authUser.userId,
            created_by: authUser.userId,
          };

          console.log(
            `Inserting timesheet for employee ${employee.full_name}:`,
            insertData
          );

          const { data: insertDataResult, error: insertError } = await (
            supabase.from("weekly_attendance") as any
          )
            .insert([insertData])
            .select();

          if (insertError) {
            console.error(`Insert error for ${employee.full_name}:`, {
              error: insertError,
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              insertData,
            });
            throw insertError;
          }

          if (!insertDataResult || insertDataResult.length === 0) {
            console.error(`Insert returned no data for ${employee.full_name}`);
            throw new Error("Insert succeeded but returned no data");
          }

          console.log(
            `Successfully inserted timesheet for ${employee.full_name}:`,
            insertDataResult
          );

          results.push({
            employee_id: employee.id,
            employee_name: employee.full_name,
            status: "created",
            days_generated: timesheetData.attendance_data.length,
            total_regular_hours: timesheetData.total_regular_hours,
            total_overtime_hours: timesheetData.total_overtime_hours,
            total_night_diff_hours: timesheetData.total_night_diff_hours,
          });
        }
      } catch (error: any) {
        console.error(
          `Error processing employee ${employee.full_name}:`,
          error
        );
        errors.push({
          employee_id: employee.id,
          employee_name: employee.full_name,
          error: error.message || "Unknown error",
        });
      }
    }

    console.log("Auto-generate completed:", {
      total_processed: employees.length,
      results_count: results.length,
      errors_count: errors.length,
      results,
      errors,
    });

    return NextResponse.json({
      success: true,
      period_start,
      period_end,
      total_processed: employees.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error auto-generating timesheets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate timesheets" },
      { status: 500 }
    );
  }
}