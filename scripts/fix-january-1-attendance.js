const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

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

async function fixJanuary1Attendance() {
  console.log("================================================================================");
  console.log("FIXING JANUARY 1, 2026 ATTENDANCE RECORDS");
  console.log("================================================================================");
  console.log("Setting BH = 8 for January 1, 2026 for employees without time log entries");
  console.log("This is because they started using the system on January 6, 2026");
  console.log("");

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("(DRY RUN MODE - No changes will be made)\n");
  }

  // Fetch all weekly_attendance records for January 1-15, 2026 period
  const periodStart = "2026-01-01";
  const periodEnd = "2026-01-15";

  console.log(`Fetching attendance records for period: ${periodStart} to ${periodEnd}...`);

  const { data: attendanceRecords, error: fetchError } = await supabase
    .from("weekly_attendance")
    .select("id, employee_id, period_start, period_end, attendance_data, total_regular_hours")
    .gte("period_start", periodStart)
    .lte("period_end", periodEnd);

  if (fetchError) {
    console.error("Error fetching attendance records:", fetchError);
    process.exit(1);
  }

  console.log(`Found ${attendanceRecords.length} attendance records\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const updates = [];

  for (const record of attendanceRecords) {
    const attendanceData = record.attendance_data;

    if (!Array.isArray(attendanceData)) {
      console.warn(`⚠️  Record ${record.id}: attendance_data is not an array, skipping`);
      skippedCount++;
      continue;
    }

    // Find January 1, 2026 in the attendance data
    const jan1Index = attendanceData.findIndex(
      (day) => day.date === "2026-01-01"
    );

    if (jan1Index === -1) {
      // January 1 not found in this record, skip
      skippedCount++;
      continue;
    }

    const jan1Day = attendanceData[jan1Index];

    // Check if January 1 is a holiday (regular-holiday or non-working-holiday)
    const isHoliday =
      jan1Day.dayType === "regular-holiday" ||
      jan1Day.dayType === "non-working-holiday";

    if (!isHoliday) {
      // Not a holiday, skip
      skippedCount++;
      continue;
    }

    // Check if BH is already 8 or if they have time log entries (regularHours > 0)
    // Note: attendance_data from timesheet generator uses 'regularHours', but the timesheet page uses 'bh'
    // We need to check both fields
    const currentBH = jan1Day.bh || jan1Day.regularHours || 0;
    const regularHours = jan1Day.regularHours || 0;

    // If they already have 8 BH or worked on that day (regularHours > 0), skip
    if (currentBH >= 8 || regularHours > 0) {
      skippedCount++;
      continue;
    }

    // Update January 1 to have 8 BH
    // The timesheet generator stores 'regularHours', but the timesheet page expects 'bh'
    // We'll set both to ensure compatibility
    const updatedAttendanceData = [...attendanceData];
    updatedAttendanceData[jan1Index] = {
      ...jan1Day,
      bh: 8, // Set bh for timesheet page display
      regularHours: 8, // Set regularHours for timesheet generator compatibility
    };

    // Recalculate total_regular_hours
    // Use regularHours if available, otherwise use bh
    const newTotalRegularHours = updatedAttendanceData.reduce((sum, day) => {
      return sum + (day.regularHours || day.bh || 0);
    }, 0);

    updates.push({
      id: record.id,
      employee_id: record.employee_id,
      oldBH: currentBH,
      newBH: 8,
      oldTotalRegularHours: record.total_regular_hours,
      newTotalRegularHours: newTotalRegularHours,
    });

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("weekly_attendance")
        .update({
          attendance_data: updatedAttendanceData,
          total_regular_hours: newTotalRegularHours,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);

      if (updateError) {
        console.error(`❌ Error updating record ${record.id}:`, updateError.message);
        errorCount++;
        continue;
      }
    }

    updatedCount++;
  }

  // Get employee names for display
  const employeeIds = updates.map((u) => u.employee_id);
  const { data: employees } = await supabase
    .from("employees")
    .select("id, employee_id, full_name")
    .in("id", employeeIds);

  const employeeMap = new Map(
    (employees || []).map((e) => [e.id, e])
  );

  console.log("\n" + "=".repeat(80));
  console.log("UPDATE SUMMARY");
  console.log("=".repeat(80));

  if (updates.length > 0) {
    console.log("\nRecords to be updated:\n");
    updates.forEach((update) => {
      const employee = employeeMap.get(update.employee_id);
      const employeeName = employee
        ? `${employee.full_name} (${employee.employee_id})`
        : `Employee ${update.employee_id}`;

      console.log(
        `✓ ${employeeName.padEnd(40)} | BH: ${update.oldBH} → ${update.newBH} | Total Hours: ${update.oldTotalRegularHours} → ${update.newTotalRegularHours}`
      );
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log(`Total records processed: ${attendanceRecords.length}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  if (dryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes were made");
    console.log("Run without --dry-run to apply changes");
  } else {
    console.log("\n✅ January 1 attendance records updated successfully");
  }

  console.log("\n" + "=".repeat(80));
}

// Run the fix
fixJanuary1Attendance()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });