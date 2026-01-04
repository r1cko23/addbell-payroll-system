/**
 * Script to reset all employee SIL credits for 2026
 * This ensures all employees have their 2025 unused credits zeroed out
 * and their accrual logic properly applied for 2026
 */

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  console.error(
    "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetAllEmployeesFor2026() {
  console.log("🔄 Starting SIL reset for 2026...\n");

  // Get all employees
  const { data: employees, error: fetchError } = await supabase
    .from("employees")
    .select("id, first_name, last_name, hire_date, sil_credits, sil_balance_year")
    .order("hire_date", { ascending: true });

  if (fetchError) {
    console.error("❌ Error fetching employees:", fetchError);
    return;
  }

  if (!employees || employees.length === 0) {
    console.log("No employees found");
    return;
  }

  console.log(`Found ${employees.length} employees\n`);

  let resetCount = 0;
  let alreadyResetCount = 0;
  let errors = 0;

  for (const emp of employees) {
    try {
      // Call the refresh function which will handle the reset and accrual
      const { data, error } = await supabase.rpc(
        "refresh_employee_leave_balances",
        {
          p_employee_id: emp.id,
        }
      );

      if (error) {
        console.error(
          `❌ Error for ${emp.first_name} ${emp.last_name}:`,
          error.message
        );
        errors++;
        continue;
      }

      // Check if reset happened
      const { data: updatedEmp } = await supabase
        .from("employees")
        .select("sil_balance_year, sil_credits, sil_last_accrual")
        .eq("id", emp.id)
        .single();

      if (updatedEmp?.sil_balance_year === 2026) {
        if (emp.sil_balance_year !== 2026) {
          resetCount++;
          console.log(
            `✅ Reset: ${emp.first_name} ${emp.last_name} - Credits: ${updatedEmp.sil_credits?.toFixed(2)} (was ${emp.sil_credits?.toFixed(2)})`
          );
        } else {
          alreadyResetCount++;
        }
      }
    } catch (err) {
      console.error(
        `❌ Exception for ${emp.first_name} ${emp.last_name}:`,
        err
      );
      errors++;
    }
  }

  console.log("\n📊 Summary:");
  console.log(`   ✅ Reset: ${resetCount} employees`);
  console.log(`   ℹ️  Already reset: ${alreadyResetCount} employees`);
  console.log(`   ❌ Errors: ${errors} employees`);
  console.log(`   📝 Total processed: ${employees.length} employees`);
}

// Run the reset
resetAllEmployeesFor2026()
  .then(() => {
    console.log("\n✨ Reset complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });