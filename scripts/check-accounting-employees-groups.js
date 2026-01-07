/**
 * Script to check if employees in ACCOUNTING group have their overtime_group_id set
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log("=".repeat(80));
  console.log("CHECKING ACCOUNTING GROUP EMPLOYEES");
  console.log("=".repeat(80));
  console.log();

  try {
    // Get ACCOUNTING group
    const { data: accountingGroup, error: groupError } = await supabase
      .from("overtime_groups")
      .select("id, name, approver_id")
      .eq("name", "ACCOUNTING")
      .single();

    if (groupError || !accountingGroup) {
      console.error("Error finding ACCOUNTING group:", groupError);
      return;
    }

    console.log("ACCOUNTING Group:");
    console.log(`  ID: ${accountingGroup.id}`);
    console.log(`  Name: ${accountingGroup.name}`);
    console.log(`  Approver ID: ${accountingGroup.approver_id}`);
    console.log();

    // Get approver info
    if (accountingGroup.approver_id) {
      const { data: approver, error: approverError } = await supabase
        .from("users")
        .select("id, email, full_name, role")
        .eq("id", accountingGroup.approver_id)
        .single();

      if (!approverError && approver) {
        console.log("Approver:");
        console.log(`  Name: ${approver.full_name}`);
        console.log(`  Email: ${approver.email}`);
        console.log(`  Role: ${approver.role}`);
        console.log();
      }
    }

    // Get all employees in ACCOUNTING group
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, overtime_group_id, position")
      .eq("overtime_group_id", accountingGroup.id)
      .order("full_name");

    if (empError) {
      console.error("Error fetching employees:", empError);
      return;
    }

    console.log(`Employees in ACCOUNTING group: ${employees?.length || 0}`);
    console.log();

    if (employees && employees.length > 0) {
      employees.forEach((emp, index) => {
        console.log(`${index + 1}. ${emp.full_name} (${emp.employee_id})`);
        console.log(`   Position: ${emp.position || "N/A"}`);
        console.log(`   Email: ${emp.email || "N/A"}`);
        console.log(`   Overtime Group ID: ${emp.overtime_group_id}`);
        console.log();
      });
    } else {
      console.log("⚠️  No employees found in ACCOUNTING group!");
      console.log();
      console.log("Checking employees with ACCOUNTING-related positions...");

      // Check for employees that should be in ACCOUNTING but aren't
      const { data: accountingPositions, error: posError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, overtime_group_id, position")
        .or("position.ilike.%ACCOUNTING%,position.ilike.%TIMEKEEPING%,position.ilike.%PAYROLL%,position.ilike.%BILLING%,position.ilike.%COLLECTION%")
        .order("full_name")
        .limit(20);

      if (!posError && accountingPositions) {
        console.log(`Found ${accountingPositions.length} employees with ACCOUNTING-related positions:`);
        accountingPositions.forEach((emp, index) => {
          console.log(`${index + 1}. ${emp.full_name} (${emp.employee_id})`);
          console.log(`   Position: ${emp.position}`);
          console.log(`   Current Group ID: ${emp.overtime_group_id || "NULL"}`);
          console.log();
        });
      }
    }

    // Check recent OT requests for ACCOUNTING employees
    console.log();
    console.log("Recent OT Requests (last 7 days) for ACCOUNTING employees:");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    if (employees && employees.length > 0) {
      const employeeIds = employees.map(e => e.id);
      const { data: otRequests, error: otError } = await supabase
        .from("overtime_requests")
        .select(`
          id,
          ot_date,
          total_hours,
          status,
          employees!inner(id, employee_id, full_name, overtime_group_id)
        `)
        .in("employee_id", employeeIds)
        .gte("ot_date", dateStr)
        .order("ot_date", { ascending: false })
        .limit(10);

      if (!otError && otRequests) {
        console.log(`Found ${otRequests.length} OT requests:`);
        otRequests.forEach((req, index) => {
          console.log(`${index + 1}. ${req.employees?.full_name} (${req.employees?.employee_id})`);
          console.log(`   Date: ${req.ot_date}`);
          console.log(`   Hours: ${req.total_hours}`);
          console.log(`   Status: ${req.status}`);
          console.log(`   Employee Group ID: ${req.employees?.overtime_group_id}`);
          console.log();
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
