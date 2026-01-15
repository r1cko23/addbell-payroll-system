/**
 * Script to check for clock-in issues on January 5, 2026
 *
 * This script analyzes:
 * 1. How many employees should have clocked in on Jan 5
 * 2. How many actually have clock entries
 * 3. Whether Jan 5 was marked as a rest day for any employees
 * 4. Whether there were incomplete entries blocking clock-ins
 *
 * Usage:
 *   npx tsx scripts/check-jan-5-clock-issues.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { parseISO, format } from "date-fns";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkJan5Issues() {
  console.log("\n🔍 Analyzing clock-in issues for January 5, 2026...\n");

  const targetDate = "2026-01-05";
  const targetDateStart = `${targetDate}T00:00:00+08:00`; // Asia/Manila timezone
  const targetDateEnd = `${targetDate}T23:59:59+08:00`;

  // Get all active employees
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, employee_type, position, is_active")
    .eq("is_active", true);

  if (empError) {
    console.error("Error fetching employees:", empError);
    return;
  }

  console.log(`Found ${employees?.length || 0} active employees\n`);

  // Get all clock entries for Jan 5, 2026
  // Query with wider range to account for timezone differences
  const queryStart = new Date("2026-01-04T16:00:00Z"); // Jan 4 4PM UTC = Jan 5 12AM Manila
  const queryEnd = new Date("2026-01-06T15:59:59Z"); // Jan 6 4PM UTC = Jan 5 11:59PM Manila

  const { data: clockEntries, error: clockError } = await supabase
    .from("time_clock_entries")
    .select("id, employee_id, clock_in_time, clock_out_time, status, created_at")
    .gte("clock_in_time", queryStart.toISOString())
    .lte("clock_in_time", queryEnd.toISOString())
    .order("clock_in_time", { ascending: true });

  if (clockError) {
    console.error("Error fetching clock entries:", clockError);
    return;
  }

  console.log(`Found ${clockEntries?.length || 0} clock entries around Jan 5\n`);

  // Group entries by employee and check which date they fall on (Asia/Manila timezone)
  const entriesByEmployee = new Map<string, any[]>();
  const jan5EntriesByEmployee = new Map<string, any[]>();

  clockEntries?.forEach((entry) => {
    const clockInDate = parseISO(entry.clock_in_time);
    // Convert to Asia/Manila timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(clockInDate);
    const entryDateStr = `${parts.find((p) => p.type === "year")!.value}-${
      parts.find((p) => p.type === "month")!.value
    }-${parts.find((p) => p.type === "day")!.value}`;

    if (!entriesByEmployee.has(entry.employee_id)) {
      entriesByEmployee.set(entry.employee_id, []);
    }
    entriesByEmployee.get(entry.employee_id)!.push({
      ...entry,
      entryDateStr,
    });

    if (entryDateStr === targetDate) {
      if (!jan5EntriesByEmployee.has(entry.employee_id)) {
        jan5EntriesByEmployee.set(entry.employee_id, []);
      }
      jan5EntriesByEmployee.get(entry.employee_id)!.push(entry);
    }
  });

  // Check schedules for Jan 5 to see if it was marked as rest day
  const { data: schedules, error: scheduleError } = await supabase
    .from("employee_week_schedules")
    .select("employee_id, schedule_date, day_off")
    .eq("schedule_date", targetDate);

  if (scheduleError) {
    console.warn("Error fetching schedules:", scheduleError);
  }

  const restDayEmployees = new Set<string>();
  schedules?.forEach((schedule) => {
    if (schedule.day_off === true) {
      restDayEmployees.add(schedule.employee_id);
    }
  });

  console.log(`📊 Analysis Results:\n`);
  console.log(`Total active employees: ${employees?.length || 0}`);
  console.log(`Employees with Jan 5 entries: ${jan5EntriesByEmployee.size}`);
  console.log(`Employees with Jan 5 as rest day: ${restDayEmployees.size}`);
  console.log(`Employees without Jan 5 entries: ${(employees?.length || 0) - jan5EntriesByEmployee.size - restDayEmployees.size}\n`);

  // Find employees without entries who don't have rest day
  const employeesWithoutEntries = employees?.filter(
    (emp) =>
      !jan5EntriesByEmployee.has(emp.id) && !restDayEmployees.has(emp.id)
  ) || [];

  if (employeesWithoutEntries.length > 0) {
    console.log(`⚠️  Employees without Jan 5 entries (not rest day):\n`);
    employeesWithoutEntries.slice(0, 20).forEach((emp, idx) => {
      console.log(`  ${idx + 1}. ${emp.full_name} (${emp.employee_id})`);
      console.log(`     Type: ${emp.employee_type || "N/A"}`);
      console.log(`     Position: ${emp.position || "N/A"}`);

      // Check if they have incomplete entries from before Jan 5
      const employeeEntries = entriesByEmployee.get(emp.id) || [];
      const incompleteEntries = employeeEntries.filter(
        (e: any) => e.status === "clocked_in" && !e.clock_out_time
      );
      if (incompleteEntries.length > 0) {
        console.log(`     ⚠️  Has ${incompleteEntries.length} incomplete entry/entries that might block clock-in`);
        incompleteEntries.forEach((inc: any) => {
          console.log(`        - Entry from ${inc.entryDateStr || format(parseISO(inc.clock_in_time), "yyyy-MM-dd")} (status: ${inc.status})`);
        });
      }
      console.log("");
    });

    if (employeesWithoutEntries.length > 20) {
      console.log(`  ... and ${employeesWithoutEntries.length - 20} more\n`);
    }
  }

  // Check for entries that might be in wrong year (2024 instead of 2025/2026)
  const wrongYearEntries = clockEntries?.filter((entry) => {
    const clockInDate = parseISO(entry.clock_in_time);
    const year = clockInDate.getFullYear();
    const createdDate = parseISO(entry.created_at);
    const createdYear = createdDate.getFullYear();
    return year === 2024 && createdYear >= 2025;
  }) || [];

  if (wrongYearEntries.length > 0) {
    console.log(`\n⚠️  Found ${wrongYearEntries.length} entries with wrong year (2024 instead of 2025/2026)`);
    console.log(`   These entries might not show up correctly for Jan 5, 2026\n`);
  }

  // Summary
  console.log(`\n📋 Summary:\n`);
  console.log(`- Employees expected to work: ${employees?.length || 0 - restDayEmployees.size}`);
  console.log(`- Employees with clock entries: ${jan5EntriesByEmployee.size}`);
  console.log(`- Employees with rest day: ${restDayEmployees.size}`);
  console.log(`- Missing entries: ${employeesWithoutEntries.length}`);

  if (wrongYearEntries.length > 0) {
    console.log(`- Entries with wrong year: ${wrongYearEntries.length}`);
    console.log(`\n💡 Run fix-clock-entry-years.ts to fix year issues`);
  }

  if (employeesWithoutEntries.length > 0) {
    console.log(`\n💡 Possible reasons for missing entries:`);
    console.log(`   1. Employees didn't clock in (system working correctly)`);
    console.log(`   2. Incomplete entries from previous days blocking clock-in`);
    console.log(`   3. Rest day not properly marked in schedules`);
    console.log(`   4. System error preventing clock-in`);
    console.log(`   5. Year issue (entries saved with wrong year)`);
  }
}

checkJan5Issues()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });