/**
 * Debug script to check what groups an approver should see
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
  const approverEmail = process.argv[2] || "llvaldez@greenpasture.ph";
  
  console.log("=".repeat(80));
  console.log(`DEBUGGING APPROVER GROUPS FOR: ${approverEmail}`);
  console.log("=".repeat(80));
  console.log();

  try {
    // Get user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("email", approverEmail)
      .single();

    if (userError || !user) {
      console.error("User not found:", userError);
      return;
    }

    console.log("User Info:");
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.full_name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log();

    // Find groups where this user is approver
    const { data: approverGroups, error: approverError } = await supabase
      .from("overtime_groups")
      .select("id, name, approver_id")
      .eq("approver_id", user.id);

    if (approverError) {
      console.error("Error fetching approver groups:", approverError);
      return;
    }

    console.log("Groups where user is APPROVER:");
    if (approverGroups && approverGroups.length > 0) {
      approverGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name}`);
        console.log(`   Group ID: ${group.id}`);
        console.log();
      });
    } else {
      console.log("  None found");
      console.log();
    }

    // Find groups where this user is viewer
    const { data: viewerGroups, error: viewerError } = await supabase
      .from("overtime_groups")
      .select("id, name, viewer_id")
      .eq("viewer_id", user.id);

    if (viewerError) {
      console.error("Error fetching viewer groups:", viewerError);
      return;
    }

    console.log("Groups where user is VIEWER:");
    if (viewerGroups && viewerGroups.length > 0) {
      viewerGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name}`);
        console.log(`   Group ID: ${group.id}`);
        console.log();
      });
    } else {
      console.log("  None found");
      console.log();
    }

    // Combine unique group IDs
    const allGroupIds = [
      ...(approverGroups || []).map((g) => g.id),
      ...(viewerGroups || []).map((g) => g.id),
    ];
    const uniqueGroupIds = Array.from(new Set(allGroupIds));

    console.log("=".repeat(80));
    console.log("ASSIGNED GROUP IDs (what should be used for filtering):");
    console.log(uniqueGroupIds);
    console.log("=".repeat(80));
    console.log();

    // Check employees in these groups
    if (uniqueGroupIds.length > 0) {
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, overtime_group_id")
        .in("overtime_group_id", uniqueGroupIds)
        .order("full_name")
        .limit(20);

      if (!empError && employees) {
        console.log(`Employees in assigned groups (showing first 20): ${employees.length}`);
        employees.forEach((emp, index) => {
          console.log(`${index + 1}. ${emp.full_name} (${emp.employee_id}) - Group ID: ${emp.overtime_group_id}`);
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();

