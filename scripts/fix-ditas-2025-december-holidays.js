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

async function fixDitas2025DecemberHolidays() {
  console.log("=".repeat(80));
  console.log("FIXING DITAS DECEMBER 30-31, 2025 HOLIDAYS");
  console.log("=".repeat(80));
  console.log();

  const { data: emp } = await supabase
    .from("employees")
    .select("id, employee_id, full_name")
    .eq("employee_id", "23373")
    .single();

  if (!emp) {
    console.error("Employee not found");
    return;
  }

  console.log(`Found employee: ${emp.full_name} (ID: ${emp.employee_id})\n`);

  const { data: att } = await supabase
    .from("weekly_attendance")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("period_start", "2025-12-16")
    .eq("period_end", "2025-12-31")
    .single();

  if (!att) {
    console.error("Attendance record not found");
    return;
  }

  console.log("Updating attendance record for Dec 30-31, 2025...\n");

  const data = att.attendance_data || [];

  // Check if employee worked a regular working day before Dec 30 (up to 7 days back)
  let workedBeforeDec30 = false;
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date("2025-12-30");
    checkDate.setDate(checkDate.getDate() - i);
    const checkDateStr = checkDate.toISOString().split("T")[0];
    const checkDay = data.find((d) => d.date === checkDateStr);
    if (checkDay && checkDay.dayType === "regular" && (checkDay.regularHours || 0) >= 8) {
      workedBeforeDec30 = true;
      console.log(`Found worked day before Dec 30: ${checkDateStr} - ${checkDay.regularHours} hours`);
      break;
    }
  }

  if (!workedBeforeDec30) {
    console.log("⚠️  No regular working day found before Dec 30 (within 7 days)");
    console.log("Dec 30-31 will be marked as holidays but may not be eligible for pay\n");
  }

  // Update Dec 30
  const newData = data.map((day) => {
    if (day.date === "2025-12-30") {
      const eligible = workedBeforeDec30;
      return {
        ...day,
        dayType: "regular-holiday",
        regularHours: eligible ? 8 : 0,
        bh: eligible ? 8 : 0,
        status: "RH",
      };
    }
    return day;
  });

  // Update Dec 31 (check if Dec 30 is eligible for consecutive holiday rule)
  const dec30Updated = newData.find((d) => d.date === "2025-12-30");
  const dec30Eligible = dec30Updated && (dec30Updated.regularHours || 0) >= 8;
  const finalData = newData.map((day) => {
    if (day.date === "2025-12-31") {
      const eligible = workedBeforeDec30 || dec30Eligible;
      return {
        ...day,
        dayType: "non-working-holiday",
        regularHours: eligible ? 8 : 0,
        bh: eligible ? 8 : 0,
        status: "SH",
      };
    }
    return day;
  });

  const totalHours = finalData.reduce((sum, d) => sum + (d.regularHours || 0), 0);

  const { error } = await supabase
    .from("weekly_attendance")
    .update({
      attendance_data: finalData,
      total_regular_hours: totalHours,
    })
    .eq("id", att.id);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("✓ Updated successfully!\n");
  const dec30 = finalData.find((d) => d.date === "2025-12-30");
  const dec31 = finalData.find((d) => d.date === "2025-12-31");
  console.log("Dec 30:", JSON.stringify(dec30, null, 2));
  console.log("\nDec 31:", JSON.stringify(dec31, null, 2));
  console.log(`\nTotal regular hours: ${totalHours}`);
}

fixDitas2025DecemberHolidays()
  .then(() => {
    console.log("\n✅ Completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });