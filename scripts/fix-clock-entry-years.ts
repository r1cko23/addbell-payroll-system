/**
 * Script to fix clock entry years in Supabase
 * 
 * This script identifies clock entries with incorrect years (e.g., 2024 instead of 2025/2026)
 * and updates them to the correct year based on the entry's date pattern.
 * 
 * Usage:
 *   npx tsx scripts/fix-clock-entry-years.ts [--dry-run] [--year=2025]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { parseISO, format, addYears } from "date-fns";

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
}

async function fixClockEntryYears(
  targetYear: number = 2025,
  dryRun: boolean = true
) {
  console.log(`\n🔍 Checking clock entries for year issues...`);
  console.log(`Target year: ${targetYear}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will update)"}\n`);

  // Query all clock entries
  const { data: entries, error } = await supabase
    .from("time_clock_entries")
    .select("id, employee_id, clock_in_time, clock_out_time, created_at")
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

  console.log("Entries by year:");
  Array.from(entriesByYear.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([year, entries]) => {
      console.log(`  ${year}: ${entries.length} entries`);
    });

  // Find entries that need fixing (entries from 2024 that should be 2025/2026)
  const entriesToFix: Array<{
    entry: ClockEntry;
    currentYear: number;
    newClockIn: string;
    newClockOut: string | null;
  }> = [];

  entries.forEach((entry) => {
    const clockInDate = parseISO(entry.clock_in_time);
    const currentYear = clockInDate.getFullYear();
    const createdDate = parseISO(entry.created_at);
    const createdYear = createdDate.getFullYear();

    // If clock_in_time is 2024 but created_at is 2025 or later, it's likely wrong
    // Also check if clock_in_time year is significantly older than created_at year
    if (currentYear === 2024 && createdYear >= targetYear) {
      // Calculate the correct year based on created_at
      // If created in Dec 2025 or later, clock_in_time should be 2025 or 2026
      // Use the created_at year as the target year
      const yearDiff = createdYear - currentYear;
      const newClockInDate = addYears(clockInDate, yearDiff);
      const newClockIn = newClockInDate.toISOString();

      let newClockOut: string | null = null;
      if (entry.clock_out_time) {
        const clockOutDate = parseISO(entry.clock_out_time);
        const clockOutYear = clockOutDate.getFullYear();
        // Only fix clock_out if it's also from 2024
        if (clockOutYear === 2024) {
          const newClockOutDate = addYears(clockOutDate, yearDiff);
          newClockOut = newClockOutDate.toISOString();
        } else {
          // Keep original clock_out_time if it's already correct
          newClockOut = entry.clock_out_time;
        }
      }

      entriesToFix.push({
        entry,
        currentYear,
        newClockIn,
        newClockOut,
      });
    }
  });

  if (entriesToFix.length === 0) {
    console.log("\n✅ No entries found that need fixing.");
    return;
  }

  console.log(`\n📋 Found ${entriesToFix.length} entries that need fixing:\n`);

  // Group by employee for better reporting
  const byEmployee = new Map<string, typeof entriesToFix>();
  entriesToFix.forEach((item) => {
    if (!byEmployee.has(item.entry.employee_id)) {
      byEmployee.set(item.entry.employee_id, []);
    }
    byEmployee.get(item.entry.employee_id)!.push(item);
  });

  console.log(`Affected employees: ${byEmployee.size}\n`);

  // Show sample entries
  console.log("Sample entries to fix (first 10):");
  entriesToFix.slice(0, 10).forEach((item, idx) => {
    const clockInDate = parseISO(item.entry.clock_in_time);
    const newClockInDate = parseISO(item.newClockIn);
    console.log(
      `  ${idx + 1}. Entry ${item.entry.id.substring(0, 8)}...`
    );
    console.log(
      `     Clock In: ${format(clockInDate, "yyyy-MM-dd HH:mm:ss")} → ${format(newClockInDate, "yyyy-MM-dd HH:mm:ss")}`
    );
    if (item.entry.clock_out_time) {
      const clockOutDate = parseISO(item.entry.clock_out_time);
      const newClockOutDate = parseISO(item.newClockOut!);
      console.log(
        `     Clock Out: ${format(clockOutDate, "yyyy-MM-dd HH:mm:ss")} → ${format(newClockOutDate, "yyyy-MM-dd HH:mm:ss")}`
      );
    }
    console.log(`     Created: ${format(parseISO(item.entry.created_at), "yyyy-MM-dd HH:mm:ss")}\n`);
  });

  if (dryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes made");
    console.log(`Run with --dry-run=false to apply fixes`);
    return;
  }

  // Apply fixes
  console.log("\n🔧 Applying fixes...\n");
  let successCount = 0;
  let errorCount = 0;

  for (const item of entriesToFix) {
    const updateData: any = {
      clock_in_time: item.newClockIn,
    };

    if (item.newClockOut) {
      updateData.clock_out_time = item.newClockOut;
    }

    const { error: updateError } = await supabase
      .from("time_clock_entries")
      .update(updateData)
      .eq("id", item.entry.id);

    if (updateError) {
      console.error(`  ❌ Failed to update entry ${item.entry.id}:`, updateError.message);
      errorCount++;
    } else {
      successCount++;
      if (successCount % 100 === 0) {
        console.log(`  ✅ Updated ${successCount} entries...`);
      }
    }
  }

  console.log(`\n✅ Successfully updated ${successCount} entries`);
  if (errorCount > 0) {
    console.log(`❌ Failed to update ${errorCount} entries`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes("--dry-run=false");
const yearArg = args.find((arg) => arg.startsWith("--year="));
const targetYear = yearArg ? parseInt(yearArg.split("=")[1]) : 2025;

fixClockEntryYears(targetYear, dryRun)
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
