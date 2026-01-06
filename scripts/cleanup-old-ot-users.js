const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables");
  console.error(
    "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
  );
  process.exit(1);
}

// Use service role key to bypass RLS for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// List of emails from the timelog approver Excel file (the correct ones)
const validEmails = new Set([
  'mgrazal@greenpasture.ph',
  'anngammad@greenpasture.ph',
  'jonalfeche@greenpasture.ph',
  'mjmagbag@greenpasture.ph',
  'michrazal@greenpasture.ph',
  'llvaldez@greenpasture.ph',
  'cgpagulong@greenpasture.ph',
  'scaya-ay@greenpasture.ph',
  'rarazal@greenpasture.ph',
  'rmacabenta@greenpasture.ph',
]);

async function cleanupOldUsers() {
  console.log("Fetching all users from users table...\n");

  // Get all users with ot_approver or ot_viewer role
  const { data: otUsers, error: otUsersError } = await supabase
    .from("users")
    .select("id, email, full_name, role")
    .in("role", ["ot_approver", "ot_viewer"])
    .order("email");

  if (otUsersError) {
    console.error("Error fetching OT users:", otUsersError);
    process.exit(1);
  }

  console.log(`Found ${otUsers.length} users with ot_approver/ot_viewer role\n`);

  // Get all auth users
  console.log("Fetching auth users...");
  const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error("Error fetching auth users:", authError);
    process.exit(1);
  }

  const authUsers = authUsersData?.users || [];
  console.log(`Found ${authUsers.length} users in Auth\n`);

  let deletedFromUsers = 0;
  let deletedFromAuth = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails = [];

  // Find users that are NOT in the valid emails list
  const usersToDelete = otUsers.filter(user => {
    const emailLower = user.email?.toLowerCase();
    return emailLower && !validEmails.has(emailLower);
  });

  console.log(`Found ${usersToDelete.length} users to delete (not in valid list)\n`);

  if (usersToDelete.length === 0) {
    console.log("No users to delete. All OT users are valid.\n");
    return;
  }

  // Show what will be deleted
  console.log("Users to be deleted:");
  usersToDelete.forEach(user => {
    console.log(`  - ${user.email} (${user.full_name}) - Role: ${user.role}`);
  });
  console.log();

  // Ask for confirmation (in a real script, you might want to add a prompt)
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - No users will be deleted\n");
  } else {
    console.log("⚠️  WARNING: This will permanently delete users and their auth accounts!");
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Delete users
  for (const user of usersToDelete) {
    try {
      // First, remove from overtime_groups (if assigned)
      if (!dryRun) {
        await supabase
          .from("overtime_groups")
          .update({ approver_id: null })
          .eq("approver_id", user.id);

        await supabase
          .from("overtime_groups")
          .update({ viewer_id: null })
          .eq("viewer_id", user.id);
      }

      // Delete from users table
      if (!dryRun) {
        const { error: deleteUserError } = await supabase
          .from("users")
          .delete()
          .eq("id", user.id);

        if (deleteUserError) {
          throw new Error(`Failed to delete from users table: ${deleteUserError.message}`);
        }
        deletedFromUsers++;
      } else {
        deletedFromUsers++;
      }

      // Delete from Auth
      const authUser = authUsers.find(au => au.email?.toLowerCase() === user.email?.toLowerCase());

      if (authUser) {
        if (!dryRun) {
          const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);

          if (deleteAuthError) {
            throw new Error(`Failed to delete from Auth: ${deleteAuthError.message}`);
          }
          deletedFromAuth++;
        } else {
          deletedFromAuth++;
        }
        console.log(`✓ ${dryRun ? "[DRY RUN] Would delete" : "Deleted"}: ${user.email} (${user.full_name})`);
      } else {
        console.log(`⊘ Auth user not found: ${user.email} (deleted from users table only)`);
      }
    } catch (error) {
      errors++;
      const errorMsg = `Error deleting ${user.email}: ${error.message}`;
      errorDetails.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("CLEANUP SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total OT users found: ${otUsers.length}`);
  console.log(`Users to delete: ${usersToDelete.length}`);
  console.log(`Deleted from users table: ${deletedFromUsers}`);
  console.log(`Deleted from Auth: ${deletedFromAuth}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.forEach(err => console.log(`  - ${err}`));
  }

  console.log("\n" + "=".repeat(80));
}

// Run cleanup
const dryRun = process.argv.includes("--dry-run");
cleanupOldUsers(dryRun)
  .then(() => {
    console.log("\n✅ Cleanup completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  });