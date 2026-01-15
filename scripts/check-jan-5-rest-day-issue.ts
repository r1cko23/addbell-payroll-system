/**
 * Script to check if Jan 5, 2026 was incorrectly marked as rest day for many employees
 * This could explain why so many employees couldn't clock in
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

async function checkRestDayIssue() {
  console.log("\n🔍 Checking if Jan 5, 2026 was incorrectly marked as rest day...\n");

  const targetDate = "2026-01-05";

  // Check schedules for Jan 5
  const { data: schedules, error: scheduleError } = await supabase
    .from("employee_week_schedules")
    .select("employee_id, schedule_date, day_off, start_time, end_time")
    .eq("schedule_date", targetDate);

  if (scheduleError) {
    console.error("Error fetching schedules:", scheduleError);
    return;
  }

  console.log(`Found ${schedules?.length || 0} schedule entries for Jan 5, 2026\n`);

  if (!schedules || schedules.length === 0) {
    console.log("⚠️  No schedules found for Jan 5 - this could be the issue!");
    console.log("   If employees don't have schedules, the rest day check might fail\n");
    return;
  }

  // Count rest days
  const restDayCount = schedules.filter(s => s.day_off === true).length;
  const workDayCount = schedules.filter(s => s.day_off === false || s.day_off === null).length;

  console.log(`📊 Schedule breakdown:`);
  console.log(`   Rest days (day_off = true): ${restDayCount}`);
  console.log(`   Work days (day_off = false/null): ${workDayCount}\n`);

  // Get all active employees
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, employee_type")
    .eq("is_active", true);

  if (empError) {
    console.error("Error fetching employees:", empError);
    return;
  }

  const employeesWithSchedules = new Set(schedules.map(s => s.employee_id));
  const employeesWithoutSchedules = employees?.filter(emp => !employeesWithSchedules.has(emp.id)) || [];

  console.log(`📊 Employee coverage:`);
  console.log(`   Total active employees: ${employees?.length || 0}`);
  console.log(`   Employees with Jan 5 schedule: ${schedules.length}`);
  console.log(`   Employees WITHOUT Jan 5 schedule: ${employeesWithoutSchedules.length}\n`);

  if (employeesWithoutSchedules.length > 0) {
    console.log(`⚠️  Employees without schedules (first 20):`);
    employeesWithoutSchedules.slice(0, 20).forEach((emp, idx) => {
      console.log(`   ${idx + 1}. ${emp.full_name} (${emp.employee_id}) - ${emp.employee_type || "N/A"}`);
    });
    if (employeesWithoutSchedules.length > 20) {
      console.log(`   ... and ${employeesWithoutSchedules.length - 20} more\n`);
    }
  }

  // Check if Jan 5 was a Sunday (rest day for office-based)
  const jan5Date = new Date("2026-01-05");
  const dayOfWeek = jan5Date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  console.log(`\n📅 Jan 5, 2026 was a ${dayNames[dayOfWeek]}`);

  if (dayOfWeek === 0) {
    console.log(`   ⚠️  This is Sunday - office-based employees CANNOT clock in on Sunday (rest day)`);
    console.log(`   This explains why office-based employees don't have entries!\n`);
  } else {
    console.log(`   ✅ This is NOT Sunday, so office-based employees should be able to clock in\n`);
  }

  // Check office-based employees specifically
  const officeBasedEmployees = employees?.filter(emp => emp.employee_type === "office-based") || [];
  const officeBasedWithEntries = schedules.filter(s => {
    const emp = employees?.find(e => e.id === s.employee_id);
    return emp?.employee_type === "office-based";
  });

  console.log(`📊 Office-based employees:`);
  console.log(`   Total: ${officeBasedEmployees.length}`);
  console.log(`   With Jan 5 schedule: ${officeBasedWithEntries.length}`);
  console.log(`   Without schedule: ${officeBasedEmployees.length - officeBasedWithEntries.length}\n`);

  // Summary
  console.log(`\n📋 Summary:`);
  if (dayOfWeek === 0) {
    console.log(`   ✅ Jan 5 was Sunday - office-based employees correctly prevented from clocking in`);
    console.log(`   ✅ This is expected behavior (Sunday is rest day for office-based)`);
  } else {
    console.log(`   ⚠️  Jan 5 was ${dayNames[dayOfWeek]} - employees should have been able to clock in`);
    console.log(`   ⚠️  Missing entries suggest:`);
    console.log(`      1. System issue preventing clock-ins`);
    console.log(`      2. Employees didn't clock in (unlikely for 43 employees)`);
    console.log(`      3. Schedules not set up for Jan 5`);
    console.log(`      4. Rest day incorrectly marked in schedules`);
  }
}

checkRestDayIssue()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });