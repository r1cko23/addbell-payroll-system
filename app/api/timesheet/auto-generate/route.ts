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

    // Load holidays for the period
    const { data: holidaysData, error: holidaysError } = await supabase
      .from("holidays")
      .select("holiday_date, name, is_regular")
      .gte("holiday_date", period_start)
      .lte("holiday_date", period_end);

    if (holidaysError) {
      console.error("Error loading holidays:", holidaysError);
      // Continue without holidays if there's an error
    }

    // Normalize holidays to ensure consistent date format
    const { normalizeHolidays } = await import("@/utils/holidays");
    const normalizedHolidays = normalizeHolidays(
      (holidaysData || []).map((h) => ({
        date: h.holiday_date,
        name: h.name || "",
        type: h.is_regular ? "regular" : "non-working",
      }))
    );

    const holidays = normalizedHolidays.map((h) => ({
      holiday_date: h.date,
      holiday_type: h.type,
    }));

    // Load employees (all active or specific ones)
    // Note: rate_per_day and rate_per_hour were removed from employees table
    // Gross pay is calculated from weekly_attendance or time clock entries
    let employeesQuery = supabase
      .from("employees")
      .select("id, employee_id, full_name, last_name, first_name")
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

    // Batch fetch all clock entries for all employees at once
    const { data: allClockEntries, error: clockError } = await supabase
      .from("time_clock_entries")
      .select(
        "id, clock_in_time, clock_out_time, regular_hours, overtime_hours, total_night_diff_hours, status, employee_id"
      )
      .in("employee_id", employeeIds)
      .gte("clock_in_time", `${period_start}T00:00:00`)
      .lte("clock_in_time", `${period_end}T23:59:59`)
      .order("clock_in_time", { ascending: true });

    if (clockError) {
      throw clockError;
    }

    // Group clock entries by employee_id
    const clockEntriesByEmployee = new Map<string, any[]>();
    (allClockEntries || []).forEach((entry) => {
      if (!clockEntriesByEmployee.has(entry.employee_id)) {
        clockEntriesByEmployee.set(entry.employee_id, []);
      }
      clockEntriesByEmployee.get(entry.employee_id)!.push(entry);
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
        // Note: API route doesn't have employee type info, so pass default values
        // Rest day logic for client-based Account Supervisors is handled in payslips page
        const timesheetData = generateTimesheetFromClockEntries(
          clockEntries as any,
          periodStart,
          periodEnd,
          holidays,
          undefined, // restDays - not available in API route
          true, // eligibleForOT - default to true
          true, // eligibleForNightDiff - default to true
          false // isClientBasedAccountSupervisor - API route doesn't have employee type info
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