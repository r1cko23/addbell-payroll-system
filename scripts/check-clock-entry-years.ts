/**
 * Script to check clock entry years in Supabase
 * 
 * This script analyzes clock entries to identify entries with incorrect years.
 * 
 * Usage:
 *   npx tsx scripts/check-clock-entry-years.ts
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

interface ClockEntry {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  created_at: string;
  status: string;
}

async function checkClockEntryYears() {
  console.log("\n🔍 Analyzing clock entries by year...\n");

  // Query all clock entries
  const { data: entries, error } = await supabase
    .from("time_clock_entries")
    .select("id, employee_id, clock_in_time, clock_out_time, created_at, status")
    .order("clock_in_time", { ascending: true });

  if (error) {
    console.error("Error fetching clock entries:", error);
    return;
  }

  if (!entries || entries.length === 0) {
    console.log("No clock entries found.");
    return;
  }

  console.log(`Found ${entries.length} total clock entries\n`);

  // Analyze entries by year
  const entriesByYear = new Map<number, ClockEntry[]>();
  entries.forEach((entry) => {
    const clockInDate = parseISO(entry.clock_in_time);
    const year = clockInDate.getFullYear();
    if (!entriesByYear.has(year)) {
      entriesByYear.set(year, []);
    }
    entriesByYear.get(year)!.push(entry);
  });

  console.log("📊 Entries by clock_in_time year:");
  Array.from(entriesByYear.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([year, entries]) => {
      console.log(`  ${year}: ${entries.length} entries`);
    });

  // Check for entries with mismatched years (clock_in_time vs created_at)
  console.log("\n🔍 Checking for year mismatches (clock_in_time vs created_at):\n");

  const mismatchedEntries: Array<{
    entry: ClockEntry;
    clockInYear: number;
    createdYear: number;
  }> = [];

  entries.forEach((entry) => {
    const clockInDate = parseISO(entry.clock_in_time);
    const createdDate = parseISO(entry.created_at);
    const clockInYear = clockInDate.getFullYear();
    const createdYear = createdDate.getFullYear();

    // Flag entries where clock_in_time is 2024 but created_at is 2025 or later
    if (clockInYear === 2024 && createdYear >= 2025) {
      mismatchedEntries.push({
        entry,
        clockInYear,
        createdYear,
      });
    }
  });

  if (mismatchedEntries.length === 0) {
    console.log("✅ No year mismatches found.");
    return;
  }

  console.log(`⚠️  Found ${mismatchedEntries.length} entries with year mismatches:\n`);

  // Group by created year
  const byCreatedYear = new Map<number, typeof mismatchedEntries>();
  mismatchedEntries.forEach((item) => {
    if (!byCreatedYear.has(item.createdYear)) {
      byCreatedYear.set(item.createdYear, []);
    }
    byCreatedYear.get(item.createdYear)!.push(item);
  });

  console.log("Mismatched entries by created_at year:");
  Array.from(byCreatedYear.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([year, entries]) => {
      console.log(`  ${year}: ${entries.length} entries`);
    });

  // Show sample entries
  console.log("\n📋 Sample mismatched entries (first 20):");
  mismatchedEntries.slice(0, 20).forEach((item, idx) => {
    const clockInDate = parseISO(item.entry.clock_in_time);
    const createdDate = parseISO(item.entry.created_at);
    console.log(`\n  ${idx + 1}. Entry ${item.entry.id.substring(0, 8)}...`);
    console.log(`     Clock In: ${format(clockInDate, "yyyy-MM-dd HH:mm:ss")} (year: ${item.clockInYear})`);
    if (item.entry.clock_out_time) {
      const clockOutDate = parseISO(item.entry.clock_out_time);
      console.log(`     Clock Out: ${format(clockOutDate, "yyyy-MM-dd HH:mm:ss")}`);
    }
    console.log(`     Created: ${format(createdDate, "yyyy-MM-dd HH:mm:ss")} (year: ${item.createdYear})`);
    console.log(`     Status: ${item.entry.status}`);
  });

  console.log(`\n💡 To fix these entries, run:`);
  console.log(`   npx tsx scripts/fix-clock-entry-years.ts --dry-run=false\n`);
}

checkClockEntryYears()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
