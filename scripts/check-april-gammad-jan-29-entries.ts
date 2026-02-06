/**
 * Query Supabase for April Gammad's exact time entries on January 29 (2026).
 * Usage: npx tsx scripts/check-april-gammad-jan-29-entries.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { format, parseISO } from "date-fns";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("\n🔍 April Gammad – time entries for January 29\n");

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name")
    .ilike("full_name", "%GAMMAD%");

  if (empError || !employees?.length) {
    console.error("Error or no employee found:", empError || "No match for GAMMAD");
    return;
  }

  const emp = employees[0];
  console.log(`Employee: ${emp.full_name} (${emp.employee_id}, id: ${emp.id})\n`);

  // January 29, 2026 in Asia/Manila: 2026-01-28 16:00 UTC -> 2026-01-30 15:59 UTC
  const dayStart = new Date("2026-01-28T16:00:00.000Z");
  const dayEnd = new Date("2026-01-30T15:59:59.999Z");

  const { data: entries, error } = await supabase
    .from("time_clock_entries")
    .select("id, clock_in_time, clock_out_time, total_hours, regular_hours, overtime_hours, total_night_diff_hours, status, is_manual_entry, employee_notes, hr_notes")
    .eq("employee_id", emp.id)
    .gte("clock_in_time", dayStart.toISOString())
    .lte("clock_in_time", dayEnd.toISOString())
    .order("clock_in_time", { ascending: true });

  if (error) {
    console.error("Error fetching time_clock_entries:", error);
    return;
  }

  if (!entries?.length) {
    console.log("No time entries found for January 29, 2026.");
    return;
  }

  console.log(`Found ${entries.length} entry/entries for Jan 29, 2026:\n`);
  entries.forEach((e, i) => {
    const inTime = e.clock_in_time ? parseISO(e.clock_in_time) : null;
    const outTime = e.clock_out_time ? parseISO(e.clock_out_time) : null;
    const inManila = inTime ? format(inTime, "yyyy-MM-dd HH:mm:ss (zzz)") : "—";
    const outManila = outTime ? format(outTime, "yyyy-MM-dd HH:mm:ss (zzz)") : "—";
    console.log(`Entry ${i + 1}:`);
    console.log(`  id: ${e.id}`);
    console.log(`  clock_in:  ${e.clock_in_time}  (Manila: ${inManila})`);
    console.log(`  clock_out: ${e.clock_out_time ?? "null"}  (Manila: ${outManila})`);
    console.log(`  total_hours: ${e.total_hours ?? "—"}, regular: ${e.regular_hours ?? "—"}, OT: ${e.overtime_hours ?? "—"}, night_diff: ${(e as any).total_night_diff_hours ?? "—"}`);
    console.log(`  status: ${e.status}, is_manual_entry: ${e.is_manual_entry}`);
    if (e.employee_notes) console.log(`  employee_notes: ${e.employee_notes}`);
    if (e.hr_notes) console.log(`  hr_notes: ${e.hr_notes}`);
    console.log("");
  });
}

main();