/**
 * Script to analyze Jan 5, 2026 clock-in attempts and potential errors
 * Checks for patterns that might indicate system issues
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

async function analyzeJan5Errors() {
  console.log("\n🔍 Analyzing Jan 5, 2026 clock-in patterns and potential errors...\n");

  const targetDate = "2026-01-05";
  const targetDateStart = `${targetDate}T00:00:00+08:00`; // Asia/Manila start
  const targetDateEnd = `${targetDate}T23:59:59+08:00`; // Asia/Manila end

  // 1. Check for entries created on Jan 5 but with wrong clock_in_time
  console.log("1️⃣ Checking for entries created on Jan 5 with date mismatches...");
  const { data: jan5CreatedEntries, error: createdError } = await supabase
    .from("time_clock_entries")
    .select("id, employee_id, clock_in_time, created_at, status")
    .gte("created_at", targetDateStart)
    .lte("created_at", targetDateEnd);

  if (createdError) {
    console.error("Error fetching created entries:", createdError);
  } else {
    console.log(`   Found ${jan5CreatedEntries?.length || 0} entries created on Jan 5\n`);

    if (jan5CreatedEntries && jan5CreatedEntries.length > 0) {
      const mismatchedDates = jan5CreatedEntries.filter(entry => {
        const clockInDate = new Date(entry.clock_in_time);
        const clockInDateStr = clockInDate.toISOString().split('T')[0];
        return clockInDateStr !== targetDate;
      });

      if (mismatchedDates.length > 0) {
        console.log(`   ⚠️  Found ${mismatchedDates.length} entries with date mismatches:`);
        mismatchedDates.slice(0, 5).forEach(entry => {
          const clockInDate = new Date(entry.clock_in_time);
          console.log(`      Entry ${entry.id}: created_at=${entry.created_at}, clock_in_time=${entry.clock_in_time} (${clockInDate.toISOString().split('T')[0]})`);
        });
        console.log();
      }
    }
  }

  // 2. Check for incomplete entries from Jan 4 that might have blocked Jan 5 clock-ins
  console.log("2️⃣ Checking for incomplete entries from Jan 4 that might have blocked Jan 5 clock-ins...");
  const jan4End = "2026-01-04T23:59:59+08:00";
  const { data: incompleteEntries, error: incompleteError } = await supabase
    .from("time_clock_entries")
    .select("id, employee_id, clock_in_time, clock_out_time, status, created_at")
    .lte("clock_in_time", jan4End)
    .eq("status", "clocked_in");

  if (incompleteError) {
    console.error("Error fetching incomplete entries:", incompleteError);
  } else {
    console.log(`   Found ${incompleteEntries?.length || 0} incomplete entries from Jan 4 or earlier\n`);

    if (incompleteEntries && incompleteEntries.length > 0) {
      // Get employee names
      const employeeIds = [...new Set(incompleteEntries.map(e => e.employee_id))];
      const { data: employees } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .in("id", employeeIds);

      const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

      console.log(`   ⚠️  Employees with incomplete entries that might have blocked Jan 5 clock-ins:`);
      incompleteEntries.slice(0, 10).forEach(entry => {
        const emp = employeeMap.get(entry.employee_id);
        const clockInDate = new Date(entry.clock_in_time);
        console.log(`      ${emp?.full_name || entry.employee_id}: Entry from ${clockInDate.toISOString().split('T')[0]} (status: ${entry.status})`);
      });
      if (incompleteEntries.length > 10) {
        console.log(`      ... and ${incompleteEntries.length - 10} more\n`);
      } else {
        console.log();
      }
    }
  }

  // 3. Check for entries around Jan 5 (Jan 4-6) to see activity patterns
  console.log("3️⃣ Checking activity patterns around Jan 5 (Jan 4-6)...");
  const jan4Start = "2026-01-04T00:00:00+08:00";
  const jan6End = "2026-01-06T23:59:59+08:00";

  const { data: surroundingEntries, error: surroundingError } = await supabase
    .from("time_clock_entries")
    .select("id, employee_id, clock_in_time, created_at")
    .gte("clock_in_time", jan4Start)
    .lte("clock_in_time", jan6End);

  if (surroundingError) {
    console.error("Error fetching surrounding entries:", surroundingError);
  } else {
    // Group by date
    const entriesByDate = new Map<string, number>();
    surroundingEntries?.forEach(entry => {
      const date = new Date(entry.clock_in_time).toISOString().split('T')[0];
      entriesByDate.set(date, (entriesByDate.get(date) || 0) + 1);
    });

    console.log("   Activity by date:");
    ["2026-01-04", "2026-01-05", "2026-01-06"].forEach(date => {
      const count = entriesByDate.get(date) || 0;
      const indicator = date === targetDate ? (count === 0 ? "❌" : "⚠️") : "✅";
      console.log(`      ${indicator} ${date}: ${count} entries`);
    });
    console.log();
  }

  // 4. Check for employees who clocked in on Jan 4 and Jan 6 but not Jan 5
  console.log("4️⃣ Identifying employees who worked Jan 4 and Jan 6 but not Jan 5...");
  const { data: jan4Entries } = await supabase
    .from("time_clock_entries")
    .select("employee_id")
    .gte("clock_in_time", "2026-01-04T00:00:00+08:00")
    .lte("clock_in_time", "2026-01-04T23:59:59+08:00");

  const { data: jan6Entries } = await supabase
    .from("time_clock_entries")
    .select("employee_id")
    .gte("clock_in_time", "2026-01-06T00:00:00+08:00")
    .lte("clock_in_time", "2026-01-06T23:59:59+08:00");

  const { data: jan5Entries } = await supabase
    .from("time_clock_entries")
    .select("employee_id")
    .gte("clock_in_time", targetDateStart)
    .lte("clock_in_time", targetDateEnd);

  const jan4EmployeeIds = new Set(jan4Entries?.map(e => e.employee_id) || []);
  const jan6EmployeeIds = new Set(jan6Entries?.map(e => e.employee_id) || []);
  const jan5EmployeeIds = new Set(jan5Entries?.map(e => e.employee_id) || []);

  const workedBothDays = [...jan4EmployeeIds].filter(id => jan6EmployeeIds.has(id));
  const missingJan5 = workedBothDays.filter(id => !jan5EmployeeIds.has(id));

  if (missingJan5.length > 0) {
    const { data: employees } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, employee_type")
      .in("id", missingJan5);

    console.log(`   ⚠️  Found ${missingJan5.length} employees who worked Jan 4 and Jan 6 but NOT Jan 5:`);
    employees?.slice(0, 15).forEach(emp => {
      console.log(`      ${emp.full_name} (${emp.employee_id}) - ${emp.employee_type || "N/A"}`);
    });
    if (missingJan5.length > 15) {
      console.log(`      ... and ${missingJan5.length - 15} more`);
    }
    console.log();
  } else {
    console.log("   ✅ No employees found who worked both Jan 4 and Jan 6 but not Jan 5\n");
  }

  // 5. Check if there are any database-level logs or audit tables
  console.log("5️⃣ Checking for audit/log tables...");
  const { data: tables } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .like("table_name", "%log%")
    .or("table_name.like.%audit%,table_name.like.%error%");

  if (tables && tables.length > 0) {
    console.log(`   Found potential log/audit tables: ${tables.map(t => t.table_name).join(", ")}\n`);
  } else {
    console.log("   No dedicated log/audit tables found\n");
  }

  // Summary
  console.log("\n📋 Summary:");
  console.log("   To access Supabase logs directly:");
  console.log("   1. Go to Supabase Dashboard > Logs > Postgres Logs");
  console.log("   2. Filter by date: 2026-01-05");
  console.log("   3. Search for: 'employee_clock_in', 'clock_in_now', 'error', 'exception'");
  console.log("   4. Check for RPC call failures or database errors");
  console.log("\n   Possible causes based on analysis:");
  console.log("   - Incomplete entries from Jan 4 blocking Jan 5 clock-ins");
  console.log("   - System outage or deployment on Jan 5");
  console.log("   - Database connection issues");
  console.log("   - Migration 142 applied incorrectly (though code looks correct)");
}

analyzeJan5Errors()
  .then(() => {
    console.log("\n✨ Analysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });