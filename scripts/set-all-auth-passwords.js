/**
 * Sets all Supabase Auth user passwords to a given value.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Usage: node scripts/set-all-auth-passwords.js [password]
 * Default password: test123
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
  auth: { autoRefreshToken: false, persistSession: false },
});

const newPassword = process.argv[2] || "test123";

async function main() {
  console.log("Setting all Auth user passwords to:", newPassword);
  console.log();

  try {
    const { data: authData, error: listError } =
      await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (listError) {
      throw listError;
    }

    const users = authData?.users || [];

    if (users.length === 0) {
      console.log("No users found in Auth.");
      return;
    }

    let success = 0;
    let failed = 0;

    for (const user of users) {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (error) {
        console.error(`  ✗ ${user.email}: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ ${user.email}`);
        success++;
      }
    }

    console.log();
    console.log(`Done. Updated: ${success}, Failed: ${failed}`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
