/**
 * Script to regenerate all attendance records with corrected logic:
 * - Saturday counts as 8 hours even without time log (company benefit)
 * - Partial hours are floored down
 * - Full cutoff should total 104 hours (13 days * 8 hours) if no absences
 */

import { createClient } from "@supabase/supabase-js";
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { format, parseISO } from "date-fns";
import { determineDayType } from "@/utils/holidays";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function regenerateAttendanceRecords() {
  console.log("Starting attendance record regeneration...");

  // Get all active employees
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, full_name, employee_type, job_level, position")
    .eq("is_active", true);

  if (empError) {
    console.error("Error loading employees:", empError);
    return;
  }

  console.log(`Found ${employees?.length || 0} active employees`);

  // Get all attendance records
  const { data: attendanceRecords, error: attError } = await supabase
    .from("weekly_attendance")
    .select("id, employee_id, period_start, period_end, status")
    .order("employee_id")
    .order("period_start", { ascending: false });

  if (attError) {
    console.error("Error loading attendance records:", attError);
    return;
  }

  console.log(`Found ${attendanceRecords?.length || 0} attendance records`);

  // Group by employee and period
  const recordsByEmployee = new Map<string, typeof attendanceRecords>();
  attendanceRecords?.forEach((record) => {
    if (!recordsByEmployee.has(record.employee_id)) {
      recordsByEmployee.set(record.employee_id, []);
    }
    recordsByEmployee.get(record.employee_id)!.push(record);
  });

  let successCount = 0;
  let errorCount = 0;

  // Process each employee
  for (const employee of employees || []) {
    const records = recordsByEmployee.get(employee.id) || [];
    console.log(`\nProcessing ${employee.full_name} (${records.length} records)...`);

    for (const record of records) {
      try {
        // Load holidays for the period
        const { data: holidaysData } = await supabase
          .from("holidays")
          .select("holiday_date, is_regular")
          .gte("holiday_date", record.period_start)
          .lte("holiday_date", record.period_end);

        const holidays = (holidaysData || []).map((h) => ({
          holiday_date: h.holiday_date,
          holiday_type: h.is_regular ? "regular" : "non-working",
        }));

        // Load clock entries for the period
        const { data: clockEntries } = await supabase
          .from("time_clock_entries")
          .select(
            "id, clock_in_time, clock_out_time, regular_hours, overtime_hours, total_night_diff_hours, status"
          )
          .eq("employee_id", employee.id)
          .gte("clock_in_time", `${record.period_start}T00:00:00`)
          .lte("clock_in_time", `${record.period_end}T23:59:59`)
          .order("clock_in_time", { ascending: true });

        // Determine if employee is eligible for OT and ND
        const isAccountSupervisor =
          employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") ||
          false;
        const isEligibleForOT = true; // All employees are eligible for OT
        const isEligibleForNightDiff = !isAccountSupervisor; // Account Supervisors don't have ND

        // Generate attendance data
        const periodStart = parseISO(record.period_start);
        const periodEnd = parseISO(record.period_end);

        // Check if employee is client-based Account Supervisor
        const isClientBasedAccountSupervisor = 
          employee.employee_type === "client-based" &&
          (employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false);

        const timesheetData = generateTimesheetFromClockEntries(
          (clockEntries || []) as any,
          periodStart,
          periodEnd,
          holidays,
          undefined, // restDays map - not available in regenerate script
          isEligibleForOT,
          isEligibleForNightDiff,
          isClientBasedAccountSupervisor
        );

        // Floor down all hours (ensure partial hours are rounded down)
        timesheetData.attendance_data = timesheetData.attendance_data.map((day) => ({
          ...day,
          regularHours: Math.floor(day.regularHours),
          overtimeHours: Math.floor(day.overtimeHours),
          nightDiffHours: Math.floor(day.nightDiffHours),
        }));

        // Recalculate totals after flooring
        timesheetData.total_regular_hours = Math.floor(
          timesheetData.attendance_data.reduce(
            (sum, day) => sum + day.regularHours,
            0
          )
        );
        timesheetData.total_overtime_hours = Math.floor(
          timesheetData.attendance_data.reduce(
            (sum, day) => sum + day.overtimeHours,
            0
          )
        );
        timesheetData.total_night_diff_hours = Math.floor(
          timesheetData.attendance_data.reduce(
            (sum, day) => sum + day.nightDiffHours,
            0
          )
        );

        // Update the attendance record
        const { error: updateError } = await supabase
          .from("weekly_attendance")
          .update({
            attendance_data: timesheetData.attendance_data,
            total_regular_hours: timesheetData.total_regular_hours,
            total_overtime_hours: timesheetData.total_overtime_hours,
            total_night_diff_hours: timesheetData.total_night_diff_hours,
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);

        if (updateError) {
          console.error(
            `  Error updating ${record.period_start} - ${record.period_end}:`,
            updateError.message
          );
          errorCount++;
        } else {
          console.log(
            `  ✓ Updated ${record.period_start} - ${record.period_end}: ${timesheetData.total_regular_hours} hours`
          );
          successCount++;
        }
      } catch (error: any) {
        console.error(
          `  Error processing ${record.period_start} - ${record.period_end}:`,
          error.message
        );
        errorCount++;
      }
    }
  }

  console.log(`\n\nRegeneration complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the script
regenerateAttendanceRecords()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });