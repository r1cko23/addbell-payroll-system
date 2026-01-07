const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function fixDitasDecemberHolidays() {
  console.log("=".repeat(80));
  console.log("FIXING DITAS DECEMBER 30-31 HOLIDAYS");
  console.log("=".repeat(80));
  console.log();

  // Find DITAS
  const { data: emp, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name")
    .eq("employee_id", "23373")
    .single();

  if (empError || !emp) {
    console.error("Error finding DITAS:", empError);
    return;
  }

  console.log(`Found employee: ${emp.full_name} (ID: ${emp.employee_id})\n`);

  // Get attendance records for December 2024
  const { data: attendance, error: attError } = await supabase
    .from("weekly_attendance")
    .select("*")
    .eq("employee_id", emp.id)
    .gte("period_start", "2024-12-23")
    .lte("period_end", "2025-01-05")
    .order("period_start");

  if (attError) {
    console.error("Error fetching attendance:", attError);
    return;
  }

  if (!attendance || attendance.length === 0) {
    console.log("No attendance records found for this period.");
    console.log("You may need to regenerate attendance records first.");
    return;
  }

  // Check holidays
  const { data: holidays } = await supabase
    .from("holidays")
    .select("*")
    .in("holiday_date", ["2024-12-30", "2024-12-31", "2025-12-30", "2025-12-31"])
    .order("holiday_date");

  console.log("Holidays found:");
  holidays.forEach(h => {
    console.log(`  ${h.holiday_date}: ${h.name} (${h.is_regular ? 'regular' : 'non-working'})`);
  });
  console.log();

  // Check each attendance record
  for (const att of attendance) {
    const data = att.attendance_data || [];
    let needsUpdate = false;
    const updatedData = [...data];

    // Check Dec 29, 30, 31
    const dec29 = updatedData.find(d => d.date === "2024-12-29");
    const dec30 = updatedData.find(d => d.date === "2024-12-30");
    const dec31 = updatedData.find(d => d.date === "2024-12-31");

    console.log(`\n=== Period: ${att.period_start} to ${att.period_end} ===`);

    if (dec29) {
      console.log(`Dec 29: status=${dec29.status || 'none'}, dayType=${dec29.dayType || 'none'}, regularHours=${dec29.regularHours || 0}, bh=${dec29.bh || 0}`);
    } else {
      console.log("Dec 29: NOT FOUND in attendance data");
    }

    if (dec30) {
      console.log(`Dec 30: status=${dec30.status || 'none'}, dayType=${dec30.dayType || 'none'}, regularHours=${dec30.regularHours || 0}, bh=${dec30.bh || 0}`);

      // Check if it's marked as a holiday
      const isHoliday = dec30.dayType === "regular-holiday" || dec30.dayType === "non-working-holiday";
      const workedDec29 = dec29 && (dec29.regularHours || 0) >= 8 && dec29.dayType === "regular";

      if (isHoliday && dec30.regularHours === 0 && workedDec29) {
        console.log("  ⚠️  Dec 30 is a holiday but regularHours=0. Should be 8 (eligible - worked Dec 29)");
        dec30.regularHours = 8;
        dec30.bh = 8;
        needsUpdate = true;
      } else if (isHoliday && dec30.regularHours === 0 && !workedDec29) {
        console.log("  ⚠️  Dec 30 is a holiday but employee didn't work Dec 29 (not eligible)");
      } else if (!isHoliday) {
        console.log("  ⚠️  Dec 30 is NOT marked as a holiday in attendance data!");
      }
    } else {
      console.log("Dec 30: NOT FOUND in attendance data");
    }

    if (dec31) {
      console.log(`Dec 31: status=${dec31.status || 'none'}, dayType=${dec31.dayType || 'none'}, regularHours=${dec31.regularHours || 0}, bh=${dec31.bh || 0}`);

      // Check if it's marked as a holiday
      const isHoliday = dec31.dayType === "regular-holiday" || dec31.dayType === "non-working-holiday";
      const workedDec30 = dec30 && (dec30.regularHours || 0) >= 8;

      if (isHoliday && dec31.regularHours === 0 && workedDec30) {
        console.log("  ⚠️  Dec 31 is a holiday but regularHours=0. Should be 8 (eligible - worked Dec 30)");
        dec31.regularHours = 8;
        dec31.bh = 8;
        needsUpdate = true;
      } else if (isHoliday && dec31.regularHours === 0 && !workedDec30) {
        console.log("  ⚠️  Dec 31 is a holiday but employee didn't work Dec 30 (not eligible)");
      } else if (!isHoliday) {
        console.log("  ⚠️  Dec 31 is NOT marked as a holiday in attendance data!");
      }
    } else {
      console.log("Dec 31: NOT FOUND in attendance data");
    }

    if (needsUpdate) {
      console.log("\n  → Updating attendance record...");
      const { error: updateError } = await supabase
        .from("weekly_attendance")
        .update({ attendance_data: updatedData })
        .eq("id", att.id);

      if (updateError) {
        console.error("  ✗ Error updating:", updateError.message);
      } else {
        console.log("  ✓ Updated successfully");
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("COMPLETED");
  console.log("=".repeat(80));
}

fixDitasDecemberHolidays()
  .then(() => {
    console.log("\n✅ Check completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
