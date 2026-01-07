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

async function checkGPHeadsEmployees() {
  // GP HEADS employee IDs from the Excel file
  const gpHeadsEmployeeIds = [
    '24743', // ANDRES ALFECHE II
    '23318', // SHYNA AYA-AY
    '23321', // APRIL NIÑA GAMMAD
    '23333', // REGINE MACABENTA
    '23329', // LEA MAGBAG
    '23368', // MICHAEL MAGBAG
    '27395', // MICHELLE RAZAL
  ];

  console.log("=".repeat(80));
  console.log("CHECKING GP HEADS EMPLOYEES");
  console.log("=".repeat(80));
  console.log();

  // Get all employees with their overtime groups
  const { data: employees, error } = await supabase
    .from("employees")
    .select(`
      employee_id,
      full_name,
      position,
      overtime_group_id,
      overtime_groups (
        id,
        name
      )
    `)
    .in("employee_id", gpHeadsEmployeeIds)
    .order("full_name");

  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }

  // Get GP HEADS group ID
  const { data: gpHeadsGroup } = await supabase
    .from("overtime_groups")
    .select("id, name")
    .eq("name", "GP HEADS")
    .single();

  console.log(`Found ${employees.length} employees to check:\n`);

  employees.forEach((emp) => {
    const currentGroup = emp.overtime_groups?.name || "UNASSIGNED";
    const shouldBeGPHeads = emp.overtime_group_id === gpHeadsGroup?.id;
    const status = shouldBeGPHeads ? "✓" : "✗";

    console.log(`${status} ${emp.full_name} (ID: ${emp.employee_id})`);
    console.log(`   Position: ${emp.position || "N/A"}`);
    console.log(`   Current Group: ${currentGroup}`);
    console.log(`   Should be GP HEADS: ${shouldBeGPHeads ? "YES" : "NO"}`);
    if (!shouldBeGPHeads) {
      console.log(`   ⚠️  NEEDS TO BE MOVED TO GP HEADS`);
    }
    console.log();
  });

  const correct = employees.filter(
    (emp) => emp.overtime_group_id === gpHeadsGroup?.id
  ).length;
  const incorrect = employees.length - correct;

  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total checked: ${employees.length}`);
  console.log(`Correctly assigned to GP HEADS: ${correct}`);
  console.log(`Incorrectly assigned: ${incorrect}`);
  console.log();
}

checkGPHeadsEmployees()
  .then(() => {
    console.log("✅ Check completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
