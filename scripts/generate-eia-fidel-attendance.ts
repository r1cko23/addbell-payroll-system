/**
 * Script to generate weekly attendance record for Eia Fidel
 * for the period January 1-15, 2026
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { format, parseISO } from "date-fns";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateAttendance() {
  console.log("\n🔍 Generating weekly attendance for Eia Fidel (Jan 1-15, 2026)...\n");

  // Find Eia Fidel
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, employee_type, position, eligible_for_ot")
    .ilike("full_name", "%fidel%")
    .ilike("full_name", "%eia%")
    .limit(1);

  if (empError || !employees || employees.length === 0) {
    console.error("Error finding employee:", empError);
    process.exit(1);
  }

  const eia = employees[0];
  console.log(`Found: ${eia.full_name} (${eia.employee_id})`);
  console.log(`Employee Type: ${eia.employee_type || "office-based"}`);
  console.log(`Position: ${eia.position || "N/A"}\n`);

  const periodStart = parseISO("2026-01-01");
  const periodEnd = parseISO("2026-01-15");
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");

  console.log(`Period: ${periodStartStr} to ${periodEndStr}\n`);

  // Check if attendance already exists
  const { data: existing } = await supabase
    .from("weekly_attendance")
    .select("id")
    .eq("employee_id", eia.id)
    .eq("period_start", periodStartStr)
    .eq("period_end", periodEndStr)
    .maybeSingle();

  if (existing) {
    console.log("⚠️  Weekly attendance already exists for this period!");
    console.log(`   ID: ${existing.id}`);
    console.log("   Skipping generation...\n");
    process.exit(0);
  }

  // Load clock entries
  const { data: clockEntries, error: clockError } = await supabase
    .from("time_clock_entries")
    .select(
      "id, clock_in_time, clock_out_time, regular_hours, overtime_hours, total_night_diff_hours, status"
    )
    .eq("employee_id", eia.id)
    .gte("clock_in_time", `${periodStartStr}T00:00:00`)
    .lte("clock_in_time", `${periodEndStr}T23:59:59`)
    .order("clock_in_time", { ascending: true });

  if (clockError) {
    console.error("Error loading clock entries:", clockError);
    process.exit(1);
  }

  console.log(`Found ${clockEntries?.length || 0} clock entries\n`);

  if (!clockEntries || clockEntries.length === 0) {
    console.log("⚠️  No clock entries found - cannot generate attendance");
    process.exit(0);
  }

  // Load holidays
  const { data: holidays, error: holidayError } = await supabase
    .from("holidays")
    .select("holiday_date, name, is_regular")
    .gte("holiday_date", periodStartStr)
    .lte("holiday_date", periodEndStr);

  if (holidayError) {
    console.warn("Warning: Could not load holidays:", holidayError);
  }

  const holidaysArray = (holidays || []).map((h) => ({
    holiday_date: h.holiday_date,
    holiday_type: h.is_regular ? "regular-holiday" : "non-working-holiday",
  }));

  // Load schedules for rest days
  const { data: schedules, error: scheduleError } = await supabase
    .from("employee_week_schedules")
    .select("schedule_date, day_off")
    .eq("employee_id", eia.id)
    .gte("schedule_date", periodStartStr)
    .lte("schedule_date", periodEndStr);

  if (scheduleError) {
    console.warn("Warning: Could not load schedules:", scheduleError);
  }

  const restDays = new Map<string, boolean>();
  (schedules || []).forEach((s) => {
    if (s.day_off === true) {
      restDays.set(s.schedule_date, true);
    }
  });

  // Determine employee classification
  const isClientBased = eia.employee_type === "client-based";
  const isAccountSupervisor = eia.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;
  const isEligibleForOT = eia.eligible_for_ot !== false;
  // Night diff eligibility: Account Supervisors don't get ND (they have OT allowance)
  const isEligibleForNightDiff = !isAccountSupervisor && !isClientBased;

  console.log("Employee Classification:");
  console.log(`  isClientBased: ${isClientBased}`);
  console.log(`  isAccountSupervisor: ${isAccountSupervisor}`);
  console.log(`  isEligibleForOT: ${isEligibleForOT}`);
  console.log(`  isEligibleForNightDiff: ${isEligibleForNightDiff}\n`);

  // Generate timesheet
  const timesheetData = generateTimesheetFromClockEntries(
    clockEntries as any,
    periodStart,
    periodEnd,
    holidaysArray,
    restDays,
    isEligibleForOT,
    isEligibleForNightDiff,
    isAccountSupervisor,
    undefined, // approvedOTByDate
    undefined, // approvedNDByDate
    isClientBased
  );

  console.log("Generated Timesheet Data:");
  console.log(`  Total Regular Hours: ${timesheetData.total_regular_hours}`);
  console.log(`  Total OT Hours: ${timesheetData.total_overtime_hours}`);
  console.log(`  Total ND Hours: ${timesheetData.total_night_diff_hours}`);
  console.log(`  Days in attendance_data: ${timesheetData.attendance_data.length}\n`);

  // Create weekly attendance record
  const { data: newAttendance, error: insertError } = await supabase
    .from("weekly_attendance")
    .insert({
      employee_id: eia.id,
      period_start: periodStartStr,
      period_end: periodEndStr,
      attendance_data: timesheetData.attendance_data,
      total_regular_hours: timesheetData.total_regular_hours,
      total_overtime_hours: timesheetData.total_overtime_hours,
      total_night_diff_hours: timesheetData.total_night_diff_hours,
      status: "draft",
    })
    .select()
    .single();

  if (insertError) {
    console.error("❌ Error creating weekly attendance:", insertError);
    process.exit(1);
  }

  console.log("✅ Weekly attendance created successfully!");
  console.log(`   ID: ${newAttendance.id}`);
  console.log(`   Period: ${newAttendance.period_start} to ${newAttendance.period_end}`);
  console.log(`   Status: ${newAttendance.status}\n`);
}

generateAttendance()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });