/**
 * Script to list all approvers and viewers with their credentials
 * Shows email and password format for newly created users
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
  console.log("APPROVER AND VIEWER CREDENTIALS");
  console.log("=".repeat(80));
  console.log();

  try {
    // Get all overtime groups with their approvers and viewers
    const { data: groups, error: groupsError } = await supabase
      .from("overtime_groups")
      .select(
        `
        id,
        name,
        approver_id,
        viewer_id,
        approver:users!overtime_groups_approver_id_fkey(
          id,
          email,
          full_name,
          role,
          created_at
        ),
        viewer:users!overtime_groups_viewer_id_fkey(
          id,
          email,
          full_name,
          role,
          created_at
        )
      `
      )
      .order("name");

    if (groupsError) {
      throw groupsError;
    }

    if (!groups || groups.length === 0) {
      console.log("No overtime groups found.");
      return;
    }

    // Collect unique users
    const usersMap = new Map();

    groups.forEach((group) => {
      if (group.approver) {
        const email = group.approver.email;
        if (!usersMap.has(email)) {
          usersMap.set(email, {
            email: email,
            full_name: group.approver.full_name,
            role: group.approver.role,
            groups: [],
            created_at: group.approver.created_at,
          });
        }
        usersMap.get(email).groups.push({
          name: group.name,
          type: "Approver",
        });
      }

      if (group.viewer) {
        const email = group.viewer.email;
        if (!usersMap.has(email)) {
          usersMap.set(email, {
            email: email,
            full_name: group.viewer.full_name,
            role: group.viewer.role,
            groups: [],
            created_at: group.viewer.created_at,
          });
        }
        usersMap.get(email).groups.push({
          name: group.name,
          type: "Viewer",
        });
      }
    });

    // Generate password based on email prefix
    function generatePassword(email) {
      const emailPrefix = email.split("@")[0];
      return `${emailPrefix}12345678`.substring(0, 16);
    }

    // Display results
    console.log("APPROVERS:");
    console.log("-".repeat(80));
    const approvers = Array.from(usersMap.values()).filter(
      (u) => u.role === "approver" || u.groups.some((g) => g.type === "Approver")
    );
    
    if (approvers.length === 0) {
      console.log("No approvers found.");
    } else {
      approvers.forEach((user, index) => {
        const password = generatePassword(user.email);
        console.log(`${index + 1}. ${user.full_name || user.email}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: ${password}`);
        console.log(`   Groups: ${user.groups.map((g) => `${g.name} (${g.type})`).join(", ")}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log();
      });
    }

    console.log();
    console.log("VIEWERS:");
    console.log("-".repeat(80));
    const viewers = Array.from(usersMap.values()).filter(
      (u) => u.role === "viewer" || u.groups.some((g) => g.type === "Viewer")
    );
    
    if (viewers.length === 0) {
      console.log("No viewers found.");
    } else {
      viewers.forEach((user, index) => {
        const password = generatePassword(user.email);
        console.log(`${index + 1}. ${user.full_name || user.email}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: ${password}`);
        console.log(`   Groups: ${user.groups.map((g) => `${g.name} (${g.type})`).join(", ")}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log();
      });
    }

    console.log();
    console.log("=".repeat(80));
    console.log(`Total: ${approvers.length} approver(s), ${viewers.length} viewer(s)`);
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();

