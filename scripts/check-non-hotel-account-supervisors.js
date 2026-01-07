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

async function checkNonHotelAccountSupervisors() {
  // ACCOUNT SUPERVISOR FOR NON HOTEL employee IDs from the Excel file
  const nonHotelEmployeeIds = [
    '25546', // ANGELIQUE ANA MAE ABARRA
    '23344', // MARTA JOSEFINA BALUYOT
    '23360', // JENALIE DE LEON
    '25206', // ANGELINE HERNANI
    '26200', // CHRISANTA RODRIQUEZ
    '23374', // MA.FATIMA SAMSON
    '25844', // CHARLOTTE JANE SOFRANES
    '23375', // AMY ANN SOLIJON
  ];

  console.log("=".repeat(80));
  console.log("CHECKING ACCOUNT SUPERVISOR FOR NON HOTEL EMPLOYEES");
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
    .in("employee_id", nonHotelEmployeeIds)
    .order("full_name");

  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }

  // Get ACCOUNT SUPERVISOR FOR NON HOTEL group ID
  const { data: nonHotelGroup } = await supabase
    .from("overtime_groups")
    .select("id, name")
    .eq("name", "ACCOUNT SUPERVISOR FOR NON HOTEL")
    .single();

  console.log(`Found ${employees.length} employees to check:\n`);

  employees.forEach((emp) => {
    const currentGroup = emp.overtime_groups?.name || "UNASSIGNED";
    const shouldBeNonHotel = emp.overtime_group_id === nonHotelGroup?.id;
    const status = shouldBeNonHotel ? "✓" : "✗";

    console.log(`${status} ${emp.full_name} (ID: ${emp.employee_id})`);
    console.log(`   Position: ${emp.position || "N/A"}`);
    console.log(`   Current Group: ${currentGroup}`);
    console.log(`   Should be ACCOUNT SUPERVISOR FOR NON HOTEL: ${shouldBeNonHotel ? "YES" : "NO"}`);
    if (!shouldBeNonHotel) {
      console.log(`   ⚠️  NEEDS TO BE MOVED TO ACCOUNT SUPERVISOR FOR NON HOTEL`);
    }
    console.log();
  });

  const correct = employees.filter(
    (emp) => emp.overtime_group_id === nonHotelGroup?.id
  ).length;
  const incorrect = employees.length - correct;
  const missing = nonHotelEmployeeIds.length - employees.length;

  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total expected: ${nonHotelEmployeeIds.length}`);
  console.log(`Found in database: ${employees.length}`);
  console.log(`Missing from database: ${missing}`);
  console.log(`Correctly assigned to ACCOUNT SUPERVISOR FOR NON HOTEL: ${correct}`);
  console.log(`Incorrectly assigned: ${incorrect}`);
  console.log();

  if (missing > 0) {
    console.log("Missing employee IDs:");
    nonHotelEmployeeIds.forEach(id => {
      const found = employees.find(e => e.employee_id === id);
      if (!found) {
        console.log(`  - ${id}`);
      }
    });
  }
}

checkNonHotelAccountSupervisors()
  .then(() => {
    console.log("✅ Check completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });