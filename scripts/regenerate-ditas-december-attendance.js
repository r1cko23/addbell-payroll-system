const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function regenerateDitasDecemberAttendance() {
  console.log("=".repeat(80));
  console.log("REGENERATING DITAS DECEMBER ATTENDANCE WITH HOLIDAYS");
  console.log("=".repeat(80));
  console.log();

  // Find DITAS
  const { data: emp, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name")
    .eq("employee_id", "23373")
    .single();

  if (empError || !emp) {
    console.error("Error finding DITAS:", empError);
    return;
  }

  console.log(`Found employee: ${emp.full_name} (ID: ${emp.employee_id})\n`);

  // Period: December 16-31, 2024
  const periodStart = "2024-12-16";
  const periodEnd = "2024-12-31";

  console.log(`Period: ${periodStart} to ${periodEnd}\n`);

  // Check holidays
  const { data: holidaysData } = await supabase
    .from("holidays")
    .select("holiday_date, name, is_regular")
    .gte("holiday_date", periodStart)
    .lte("holiday_date", periodEnd);

  console.log("Holidays found:");
  (holidaysData || []).forEach(h => {
    console.log(`  ${h.holiday_date}: ${h.name} (${h.is_regular ? 'Regular' : 'Non-working'})`);
  });
  console.log();

  // Check existing attendance record
  const { data: existingAtt } = await supabase
    .from("weekly_attendance")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (existingAtt) {
    console.log("Found existing attendance record:");
    const dec30 = existingAtt.attendance_data?.find(d => d.date === "2024-12-30");
    const dec31 = existingAtt.attendance_data?.find(d => d.date === "2024-12-31");
    
    if (dec30) {
      console.log(`  Dec 30: dayType=${dec30.dayType}, regularHours=${dec30.regularHours}, status=${dec30.status || 'none'}`);
    }
    if (dec31) {
      console.log(`  Dec 31: dayType=${dec31.dayType}, regularHours=${dec31.regularHours}, status=${dec31.status || 'none'}`);
    }
    console.log();
  }

  console.log("To regenerate attendance records with holidays properly marked:");
  console.log("1. Go to the Timesheet page in the admin interface");
  console.log("2. Select DITAS C. ROLDAN");
  console.log("3. Click 'Regenerate Attendance' or use the auto-generate API");
  console.log("\nOR use the API endpoint:");
  console.log(`POST /api/timesheet/auto-generate`);
  console.log(`Body: {`);
  console.log(`  "period_start": "${periodStart}",`);
  console.log(`  "period_end": "${periodEnd}",`);
  console.log(`  "employee_ids": ["${emp.id}"],`);
  console.log(`  "overwrite_existing": true`);
  console.log(`}`);
  console.log();
}

regenerateDitasDecemberAttendance()
  .then(() => {
    console.log("✅ Check completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
