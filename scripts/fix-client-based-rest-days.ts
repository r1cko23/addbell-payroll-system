import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { determineDayType, normalizeHolidays } from "../utils/holidays";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables");
  console.error(
    "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
  );
  process.exit(1);
}

// Use service role key to bypass RLS for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

interface AttendanceDay {
  date: string;
  dayType: string;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
}

async function fixClientBasedRestDays() {
  console.log("================================================================================");
  console.log("FIXING CLIENT-BASED EMPLOYEE REST DAYS IN ATTENDANCE RECORDS");
  console.log("================================================================================");
  console.log("Updating dayType for client-based employees:");
  console.log("- Sunday should NOT be rest day unless explicitly marked in schedule");
  console.log("- Only scheduled rest days (Mon-Wed) should be marked as rest day");
  console.log("");

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const specificEmployee = args.find(arg => arg.startsWith("--employee="))?.split("=")[1];
  const specificPeriod = args.find(arg => arg.startsWith("--period="))?.split("=")[1];

  if (dryRun) {
    console.log("(DRY RUN MODE - No changes will be made)\n");
  }

  // Fetch all client-based employees
  console.log("Fetching client-based employees...");
  let employeeQuery = supabase
    .from("employees")
    .select("id, employee_id, full_name, employee_type")
    .eq("employee_type", "client-based")
    .eq("is_active", true);

  if (specificEmployee) {
    employeeQuery = employeeQuery.eq("employee_id", specificEmployee);
  }

  const { data: employees, error: empError } = await employeeQuery;

  if (empError) {
    console.error("Error fetching employees:", empError);
    process.exit(1);
  }

  if (!employees || employees.length === 0) {
    console.log("No client-based employees found.");
    process.exit(0);
  }

  console.log(`Found ${employees.length} client-based employee(s)\n`);

  // Fetch holidays for the period
  // Period format: YYYY-MM-DD-YYYY-MM-DD (e.g., 2025-01-01-2026-12-31)
  let periodStart = "2026-01-01";
  let periodEnd = "2026-12-31";
  if (specificPeriod) {
    const parts = specificPeriod.split("-");
    if (parts.length >= 6) {
      // Format: YYYY-MM-DD-YYYY-MM-DD
      periodStart = `${parts[0]}-${parts[1]}-${parts[2]}`;
      periodEnd = `${parts[3]}-${parts[4]}-${parts[5]}`;
    } else if (parts.length === 2) {
      // Format: YYYY-MM-DD,YYYY-MM-DD (comma separated)
      const [start, end] = specificPeriod.split(",");
      if (start && end) {
        periodStart = start.trim();
        periodEnd = end.trim();
      }
    }
  }

  console.log(`Fetching holidays for period: ${periodStart} to ${periodEnd}...`);
  const { data: holidays, error: holidayError } = await supabase
    .from("holidays")
    .select("holiday_date, name, is_regular")
    .gte("holiday_date", periodStart)
    .lte("holiday_date", periodEnd);

  if (holidayError) {
    console.error("Error fetching holidays:", holidayError);
    process.exit(1);
  }

  const normalizedHolidays = normalizeHolidays(
    (holidays || []).map((h) => ({
      date: h.holiday_date,
      name: h.name || "",
      type: h.is_regular ? ("regular" as const) : ("non-working" as const),
    }))
  );

  console.log(`Found ${normalizedHolidays.length} holiday(s)\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process each employee
  for (const employee of employees) {
    console.log(`\nProcessing: ${employee.full_name} (${employee.employee_id})`);
    console.log("─".repeat(80));

    try {
      // Fetch attendance records for this employee
      let attendanceQuery = supabase
        .from("weekly_attendance")
        .select("id, period_start, period_end, attendance_data, status")
        .eq("employee_id", employee.id)
        .gte("period_start", periodStart)
        .lte("period_end", periodEnd);

      const { data: attendanceRecords, error: attError } = await attendanceQuery;

      if (attError) {
        console.error(`  ❌ Error fetching attendance records:`, attError);
        totalErrors++;
        continue;
      }

      if (!attendanceRecords || attendanceRecords.length === 0) {
        console.log(`  ⏭️  No attendance records found`);
        totalSkipped++;
        continue;
      }

      console.log(`  Found ${attendanceRecords.length} attendance record(s)`);

      // Get date range for fetching schedules
      const allDates = new Set<string>();
      attendanceRecords.forEach((record: any) => {
        if (Array.isArray(record.attendance_data)) {
          record.attendance_data.forEach((day: AttendanceDay) => {
            if (day.date) allDates.add(day.date);
          });
        }
      });

      const dateArray = Array.from(allDates).sort();
      if (dateArray.length === 0) {
        console.log(`  ⏭️  No dates found in attendance records`);
        totalSkipped++;
        continue;
      }

      const minDate = dateArray[0];
      const maxDate = dateArray[dateArray.length - 1];

      // Fetch schedules to determine rest days
      console.log(`  Fetching schedules from ${minDate} to ${maxDate}...`);
      const { data: schedules, error: schedError } = await supabase
        .from("employee_week_schedules")
        .select("schedule_date, day_off")
        .eq("employee_id", employee.id)
        .gte("schedule_date", minDate)
        .lte("schedule_date", maxDate);

      if (schedError) {
        console.error(`  ❌ Error fetching schedules:`, schedError);
        totalErrors++;
        continue;
      }

      // Create rest days map
      const restDaysMap = new Map<string, boolean>();
      (schedules || []).forEach((sched: any) => {
        const dateStr = sched.schedule_date.split('T')[0];
        restDaysMap.set(dateStr, sched.day_off === true);
      });

      console.log(`  Found ${restDaysMap.size} schedule entry(ies) with ${Array.from(restDaysMap.values()).filter(v => v).length} rest day(s)`);

      // Process each attendance record
      for (const record of attendanceRecords) {
        const attendanceData = record.attendance_data as AttendanceDay[];

        if (!Array.isArray(attendanceData)) {
          console.log(`  ⚠️  Record ${record.id}: attendance_data is not an array, skipping`);
          totalSkipped++;
          continue;
        }

        let recordUpdated = false;
        const updatedAttendanceData = attendanceData.map((day: AttendanceDay) => {
          const dateStr = day.date;
          if (!dateStr) return day;

          // Check if this is Sunday
          const dateObj = new Date(dateStr);
          const dayOfWeek = dateObj.getDay(); // 0 = Sunday

          // For client-based employees, Sunday should NOT be rest day unless explicitly marked
          if (dayOfWeek === 0 && day.dayType === "sunday") {
            // Check if this date is actually a rest day in their schedule
            const isActuallyRestDay = restDaysMap.get(dateStr) === true;

            if (!isActuallyRestDay) {
              // This is Sunday but NOT their rest day - should be "regular"
              // But first check if it's a holiday
              const correctDayType = determineDayType(
                dateStr,
                normalizedHolidays,
                false, // isRestDay = false (not their rest day)
                true   // isClientBased = true
              );

              if (day.dayType !== correctDayType) {
                console.log(`    📝 ${dateStr} (Sunday): Changing dayType from "${day.dayType}" to "${correctDayType}"`);
                recordUpdated = true;
                return {
                  ...day,
                  dayType: correctDayType,
                };
              }
            }
          }

          // Also check if scheduled rest days (Mon-Wed) are correctly marked
          const isScheduledRestDay = restDaysMap.get(dateStr) === true;
          if (isScheduledRestDay && day.dayType !== "sunday") {
            // This is their scheduled rest day but not marked as rest day
            // Check if it's a holiday first
            const correctDayType = determineDayType(
              dateStr,
              normalizedHolidays,
              true,  // isRestDay = true (their scheduled rest day)
              true   // isClientBased = true
            );

            if (day.dayType !== correctDayType) {
              console.log(`    📝 ${dateStr} (Scheduled Rest Day): Changing dayType from "${day.dayType}" to "${correctDayType}"`);
              recordUpdated = true;
              return {
                ...day,
                dayType: correctDayType,
              };
            }
          }

          return day;
        });

        if (recordUpdated) {
          if (!dryRun) {
            // Recalculate totals
            const totalRegularHours = updatedAttendanceData.reduce(
              (sum, day) => sum + (day.regularHours || 0),
              0
            );
            const totalOvertimeHours = updatedAttendanceData.reduce(
              (sum, day) => sum + (day.overtimeHours || 0),
              0
            );
            const totalNightDiffHours = updatedAttendanceData.reduce(
              (sum, day) => sum + (day.nightDiffHours || 0),
              0
            );

            const { error: updateError } = await supabase
              .from("weekly_attendance")
              .update({
                attendance_data: updatedAttendanceData,
                total_regular_hours: totalRegularHours,
                total_overtime_hours: totalOvertimeHours,
                total_night_diff_hours: totalNightDiffHours,
                updated_at: new Date().toISOString(),
              })
              .eq("id", record.id);

            if (updateError) {
              console.error(`    ❌ Error updating record ${record.id}:`, updateError);
              totalErrors++;
            } else {
              console.log(`    ✅ Updated record ${record.id}`);
              totalUpdated++;
            }
          } else {
            console.log(`    🔍 Would update record ${record.id} (dry run)`);
            totalUpdated++;
          }
        } else {
          totalSkipped++;
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing employee ${employee.employee_id}:`, error.message);
      totalErrors++;
    }
  }

  console.log("\n================================================================================");
  console.log("SUMMARY");
  console.log("================================================================================");
  console.log(`Total records updated: ${totalUpdated}`);
  console.log(`Total records skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log("");

  if (dryRun) {
    console.log("(DRY RUN - No changes were made)");
  } else {
    console.log("✅ Fix completed!");
  }
}

// Run the fix
fixClientBasedRestDays()
  .then(() => {
    console.log("\nScript completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed:", error);
    process.exit(1);
  });