/**
 * Script to check where April Gammad's rest day pay is coming from
 * Payslip shows 16.00 hours of rest day pay for Jan 1-15, 2026
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRestDayPay() {
  console.log("\n🔍 Checking April Gammad's rest day pay calculation...\n");

  // Find April Gammad
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, employee_type, position, job_level")
    .ilike("full_name", "%GAMMAD%")
    .eq("is_active", true);

  if (empError || !employees || employees.length === 0) {
    console.error("Error finding April Gammad:", empError);
    return;
  }

  const april = employees[0];
  console.log(`Found: ${april.full_name} (${april.employee_id})`);
  console.log(`Employee Type: ${april.employee_type || "office-based"}`);
  console.log(`Position: ${april.position || "N/A"}`);
  console.log(`Job Level: ${april.job_level || "N/A"}\n`);

  // Get rate from payslip or calculate
  // For now, we'll use a placeholder - the actual rate will be shown in the calculation

  // Determine employee classification
  const isClientBased = april.employee_type === "client-based";
  const isAccountSupervisor = april.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;
  const isSupervisory = !isClientBased && [
    "PAYROLL SUPERVISOR",
    "ACCOUNT RECEIVABLE SUPERVISOR",
    "HR OPERATIONS SUPERVISOR",
    "HR SUPERVISOR"
  ].some(pos => april.position?.toUpperCase().includes(pos));
  const isManagerial = !isClientBased && april.job_level?.toUpperCase() === "MANAGERIAL";
  const isEligibleForAllowances = isAccountSupervisor || isSupervisory || isManagerial;
  const isRankAndFile = !isClientBased && !isEligibleForAllowances;

  console.log("Employee Classification:");
  console.log(`  isClientBased: ${isClientBased}`);
  console.log(`  isAccountSupervisor: ${isAccountSupervisor}`);
  console.log(`  isSupervisory: ${isSupervisory}`);
  console.log(`  isManagerial: ${isManagerial}`);
  console.log(`  isEligibleForAllowances: ${isEligibleForAllowances}`);
  console.log(`  isRankAndFile: ${isRankAndFile}\n`);

  // Check rest days for Jan 1-15, 2026
  const periodStart = "2026-01-01";
  const periodEnd = "2026-01-15";

  console.log(`Checking rest days for period: ${periodStart} to ${periodEnd}\n`);

  // Get schedules to find rest days
  const { data: schedules, error: scheduleError } = await supabase
    .from("employee_week_schedules")
    .select("schedule_date, day_off")
    .eq("employee_id", april.id)
    .gte("schedule_date", periodStart)
    .lte("schedule_date", periodEnd)
    .eq("day_off", true)
    .order("schedule_date", { ascending: true });

  if (scheduleError) {
    console.error("Error fetching schedules:", scheduleError);
  } else {
    console.log(`Found ${schedules?.length || 0} rest days in schedules:`);
    schedules?.forEach(s => {
      const date = new Date(s.schedule_date);
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
      console.log(`  ${s.schedule_date} (${dayName})`);
    });
    console.log();
  }

  // Check attendance data for rest days
  const { data: attendance, error: attendanceError } = await supabase
    .from("weekly_attendance")
    .select("attendance_data, period_start, period_end")
    .eq("employee_id", april.id)
    .gte("period_start", periodStart)
    .lte("period_end", periodEnd)
    .maybeSingle();

  if (attendanceError) {
    console.error("Error fetching attendance:", attendanceError);
  } else if (attendance?.attendance_data) {
    const attendanceData = attendance.attendance_data as any;
    
    // Find all Sundays in the period (office-based employees have Sunday as rest day)
    const sundays: string[] = [];
    const currentDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    while (currentDate <= endDate) {
      if (currentDate.getDay() === 0) { // Sunday
        sundays.push(currentDate.toISOString().split('T')[0]);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Sundays in period (Jan 1-15, 2026): ${sundays.length}`);
    sundays.forEach(date => {
      console.log(`  ${date} (Sunday)`);
    });
    console.log();

    const restDays = Object.keys(attendanceData).filter(date => {
      const day = attendanceData[date];
      return day?.dayType === "sunday" || day?.status === "RD";
    });

    console.log(`Found ${restDays.length} rest days in attendance data:`);
    restDays.forEach(date => {
      const day = attendanceData[date];
      const dateObj = new Date(date);
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dateObj.getDay()];
      console.log(`  ${date} (${dayName}):`);
      console.log(`    Status: ${day?.status || "N/A"}`);
      console.log(`    Day Type: ${day?.dayType || "N/A"}`);
      console.log(`    Regular Hours: ${day?.regularHours || 0}`);
      console.log(`    Clock In: ${day?.clockInTime || "-"}`);
      console.log(`    Clock Out: ${day?.clockOutTime || "-"}`);
    });
    console.log();

    // Check if Sundays are being counted as rest days
    if (sundays.length === 2 && restDays.length === 2) {
      console.log("✅ Found 2 Sundays in period (Jan 4 and Jan 11)");
      console.log("✅ These match the rest days in attendance data");
      console.log("✅ For Rank and File employees, Sundays are automatically rest days");
      console.log("✅ Rest day pay: 2 Sundays × 8 hours = 16 hours\n");
    }
  }

  // Calculate expected rest day pay
  console.log("Expected Rest Day Pay Calculation:\n");

  if (isRankAndFile) {
    console.log("✅ April Gammad is RANK AND FILE");
    console.log("   Rest Day Pay Rule:");
    console.log("   - Always paid, even if didn't work");
    console.log("   - 8 hours per rest day if didn't work");
    console.log("   - Multiplier: 1.3x (30% premium)\n");

    const restDayCount = schedules?.length || 0;
    const hoursPerRestDay = 8;
    const totalHours = restDayCount * hoursPerRestDay;
    const multiplier = 1.3;

    console.log(`Calculation:`);
    console.log(`  Rest Days: ${restDayCount}`);
    console.log(`  Hours per Rest Day: ${hoursPerRestDay}`);
    console.log(`  Total Hours: ${totalHours}`);
    console.log(`  Multiplier: ${multiplier}x (30% premium for rest day)\n`);

    if (totalHours === 16) {
      console.log("✅ MATCHES PAYSLIP: 16.00 hours of rest day pay");
      console.log("   This means 2 rest days × 8 hours each = 16 hours");
      console.log("   Rest day pay is calculated automatically for Rank and File employees");
      console.log("   even if they didn't work on those rest days.");
    } else {
      console.log(`⚠️  Expected ${totalHours} hours, but payslip shows 16.00 hours`);
      console.log(`   This suggests ${restDayCount} rest days found, but payslip shows 2 rest days`);
    }
  } else {
    console.log("⚠️  April Gammad is NOT Rank and File");
    console.log(`   Classification: ${isEligibleForAllowances ? "Supervisory/Managerial" : "Client-based"}`);
    console.log("   Rest Day Pay Rule:");
    console.log("   - Only paid if actually worked on rest day");
    console.log("   - No automatic 8 hours if didn't work\n");
    console.log("   ⚠️  If payslip shows 16 hours but timesheet shows no work,");
    console.log("      this might be a calculation error or data mismatch.");
  }
}

checkRestDayPay()
  .then(() => {
    console.log("\n✨ Analysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
