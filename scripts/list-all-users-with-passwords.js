/**
 * Script to list all users in the database
 * Note: Passwords are hashed in Supabase Auth and cannot be retrieved
 * This script shows the password format for users created by our scripts
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
  console.log("ALL USERS IN DATABASE");
  console.log("=".repeat(80));
  console.log();
  console.log("NOTE: Passwords are hashed in Supabase Auth and cannot be retrieved.");
  console.log("For users created by our scripts, the password format is shown below.");
  console.log();

  try {
    // Get all users from users table
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: false });

    if (usersError) {
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log("No users found in the database.");
      return;
    }

    // Function to generate password based on email (same logic as in create script)
    function generatePassword(email) {
      const emailPrefix = email.split("@")[0];
      return `${emailPrefix}12345678`.substring(0, 16);
    }

    // Get all users from Auth (to check if they exist)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.warn("Warning: Could not fetch Auth users:", authError.message);
    }

    const authUserMap = new Map();
    if (authUsers?.users) {
      authUsers.users.forEach((user) => {
        authUserMap.set(user.email?.toLowerCase(), user);
      });
    }

    console.log(`Total Users: ${users.length}`);
    console.log();
    console.log("-".repeat(80));

    // Group by role
    const usersByRole = {
      admin: [],
      hr: [],
      approver: [],
      viewer: [],
      other: [],
    };

    users.forEach((user) => {
      const role = user.role || "other";
      if (usersByRole[role]) {
        usersByRole[role].push(user);
      } else {
        usersByRole.other.push(user);
      }
    });

    // Display by role
    Object.entries(usersByRole).forEach(([role, roleUsers]) => {
      if (roleUsers.length === 0) return;

      console.log();
      console.log(`${role.toUpperCase()} (${roleUsers.length}):`);
      console.log("-".repeat(80));

      roleUsers.forEach((user, index) => {
        const authUser = authUserMap.get(user.email?.toLowerCase());
        const password = generatePassword(user.email);
        const hasAuthAccount = !!authUser;
        const isEmailConfirmed = authUser?.email_confirmed_at ? "Yes" : "No";

        console.log(`${index + 1}. ${user.full_name || "N/A"}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role || "N/A"}`);
        console.log(`   Status: ${user.is_active ? "Active" : "Inactive"}`);
        console.log(`   Password Format: ${password}`);
        console.log(`   Auth Account: ${hasAuthAccount ? "Yes" : "No"}`);
        if (hasAuthAccount) {
          console.log(`   Email Confirmed: ${isEmailConfirmed}`);
        }
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log();
      });
    });

    console.log();
    console.log("=".repeat(80));
    console.log("PASSWORD FORMAT EXPLANATION:");
    console.log("=".repeat(80));
    console.log("For users created by our scripts:");
    console.log("  Password = (email prefix) + '12345678', truncated to 16 characters");
    console.log("  Example: llvaldez@greenpasture.ph → llvaldez12345678");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();

