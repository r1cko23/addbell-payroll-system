/**
 * Script to check if Jan 5 entries exist but are grouped to wrong dates due to timezone
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

async function checkTimezoneIssues() {
  console.log("\n🔍 Checking for Jan 5 entries that might be grouped to wrong dates...\n");

  // Query entries around Jan 5 (Jan 4-6) to catch timezone edge cases
  const queryStart = new Date("2026-01-04T16:00:00Z"); // Jan 4 4PM UTC = Jan 5 12AM Manila
  const queryEnd = new Date("2026-01-06T15:59:59Z"); // Jan 6 4PM UTC = Jan 5 11:59PM Manila

  const { data: entries, error } = await supabase
    .from("time_clock_entries")
    .select("id, employee_id, clock_in_time, clock_out_time, status, created_at")
    .gte("clock_in_time", queryStart.toISOString())
    .lte("clock_in_time", queryEnd.toISOString())
    .order("clock_in_time", { ascending: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${entries?.length || 0} entries around Jan 5\n`);

  // Group by actual date in Asia/Manila timezone
  const entriesByDate = new Map<string, any[]>();

  entries?.forEach((entry) => {
    const clockInDate = parseISO(entry.clock_in_time);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(clockInDate);
    const dateStr = `${parts.find((p) => p.type === "year")!.value}-${
      parts.find((p) => p.type === "month")!.value
    }-${parts.find((p) => p.type === "day")!.value}`;

    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  });

  console.log("Entries grouped by date (Asia/Manila timezone):");
  Array.from(entriesByDate.entries())
    .sort()
    .forEach(([date, entries]) => {
      console.log(`  ${date}: ${entries.length} entries`);

      // Show sample entries for Jan 4, 5, 6
      if (date >= "2026-01-04" && date <= "2026-01-06") {
        entries.slice(0, 3).forEach((e: any) => {
          const clockInUTC = parseISO(e.clock_in_time);
          const clockInManila = new Date(clockInUTC.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
          console.log(`    - ${format(clockInUTC, "yyyy-MM-dd HH:mm:ss")} UTC = ${format(clockInManila, "yyyy-MM-dd HH:mm:ss")} Manila`);
        });
      }
    });

  // Check specifically for entries that should be Jan 5
  const jan5Entries = entriesByDate.get("2026-01-05") || [];
  console.log(`\n📊 Jan 5, 2026 entries: ${jan5Entries.length}`);

  if (jan5Entries.length > 0) {
    // Get unique employees
    const employees = new Set(jan5Entries.map((e: any) => e.employee_id));
    console.log(`   Unique employees: ${employees.size}`);

    // Get employee names
    const employeeIds = Array.from(employees);
    const { data: employeeData } = await supabase
      .from("employees")
      .select("id, full_name, employee_id")
      .in("id", employeeIds);

    console.log(`\n   Employees with Jan 5 entries:`);
    employeeData?.forEach((emp) => {
      const empEntries = jan5Entries.filter((e: any) => e.employee_id === emp.id);
      console.log(`     - ${emp.full_name} (${emp.employee_id}): ${empEntries.length} entry/entries`);
    });
  }

  // Check for entries that might be Jan 5 but grouped elsewhere
  const jan4Entries = entriesByDate.get("2026-01-04") || [];
  const jan6Entries = entriesByDate.get("2026-01-06") || [];

  console.log(`\n📊 Nearby dates:`);
  console.log(`   Jan 4: ${jan4Entries.length} entries`);
  console.log(`   Jan 5: ${jan5Entries.length} entries`);
  console.log(`   Jan 6: ${jan6Entries.length} entries`);

  // Check if any Jan 4/6 entries are actually Jan 5 (late night/early morning edge cases)
  const potentialJan5Entries = [...jan4Entries, ...jan6Entries].filter((e: any) => {
    const clockInUTC = parseISO(e.clock_in_time);
    const clockInManila = new Date(clockInUTC.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const hour = clockInManila.getHours();
    const dateStr = format(clockInManila, "yyyy-MM-dd");

    // Check if it's actually Jan 5 but grouped to Jan 4 (late night) or Jan 6 (early morning)
    return dateStr === "2026-01-05" && (hour >= 0 && hour <= 8 || hour >= 20);
  });

  if (potentialJan5Entries.length > 0) {
    console.log(`\n⚠️  Found ${potentialJan5Entries.length} entries that might be Jan 5 but grouped to nearby dates`);
  }
}

checkTimezoneIssues()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });