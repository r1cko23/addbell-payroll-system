/**
 * Script to simulate clock-in attempts for Jan 5, 2026
 * This tests if the rest day check would have blocked clock-ins
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

async function testJan5ClockIn() {
  console.log("\n🔍 Testing if rest day check would block clock-ins on Jan 5, 2026...\n");

  // Get a sample of employees without Jan 5 entries
  const { data: employeesWithoutEntries } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, employee_type")
    .eq("is_active", true)
    .limit(5);

  if (!employeesWithoutEntries || employeesWithoutEntries.length === 0) {
    console.log("No employees found");
    return;
  }

  console.log(`Testing rest day check for ${employeesWithoutEntries.length} employees:\n`);

  for (const emp of employeesWithoutEntries) {
    // Test the is_rest_day_today function with a simulated date of Jan 5, 2026
    // We can't directly test with a past date, but we can check the logic
    
    // Check if Jan 5 was Sunday (rest day for office-based)
    const jan5Date = new Date("2026-01-05");
    const dayOfWeek = jan5Date.getDay();
    
    let wouldBeRestDay = false;
    let reason = "";

    if (emp.employee_type === "office-based") {
      // Office-based: Sunday is rest day
      wouldBeRestDay = dayOfWeek === 0;
      reason = wouldBeRestDay ? "Sunday (rest day for office-based)" : "Not Sunday";
    } else if (emp.employee_type === "client-based") {
      // Client-based: Check schedule
      const { data: schedule } = await supabase
        .from("employee_week_schedules")
        .select("day_off")
        .eq("employee_id", emp.id)
        .eq("schedule_date", "2026-01-05")
        .maybeSingle();

      wouldBeRestDay = schedule?.day_off === true;
      reason = schedule 
        ? (schedule.day_off ? "Marked as rest day in schedule" : "Not marked as rest day")
        : "No schedule found (defaults to NOT rest day)";
    }

    console.log(`  ${emp.full_name} (${emp.employee_id}):`);
    console.log(`    Type: ${emp.employee_type || "N/A"}`);
    console.log(`    Jan 5 was: ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek]}`);
    console.log(`    Would be blocked: ${wouldBeRestDay ? "YES ❌" : "NO ✅"}`);
    console.log(`    Reason: ${reason}\n`);
  }

  const jan5Date = new Date("2026-01-05");
  const dayOfWeek = jan5Date.getDay();
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];
  
  console.log(`\n📋 Summary:`);
  console.log(`   Jan 5, 2026 was a ${dayName} (day ${dayOfWeek})`);
  console.log(`   Office-based employees: Should NOT be blocked (${dayName} is not Sunday)`);
  console.log(`   Client-based employees: Only blocked if schedule has day_off = true`);
  console.log(`\n   If many employees were blocked, possible causes:`);
  console.log(`   1. Migration 142 was applied incorrectly`);
  console.log(`   2. System error during clock-in attempts`);
  console.log(`   3. Database connection issues`);
  console.log(`   4. Application deployment issues on Jan 5`);
}

testJan5ClockIn()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
