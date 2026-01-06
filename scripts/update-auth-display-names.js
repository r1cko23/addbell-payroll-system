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

async function updateAuthDisplayNames() {
  console.log("Fetching users from users table...\n");

  // Get all users from users table
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, full_name")
    .order("full_name");

  if (usersError) {
    console.error("Error fetching users:", usersError);
    process.exit(1);
  }

  console.log(`Found ${users.length} users in users table\n`);

  // Get all auth users
  console.log("Fetching auth users...");
  const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error("Error fetching auth users:", authError);
    process.exit(1);
  }

  const authUsers = authUsersData?.users || [];
  console.log(`Found ${authUsers.length} users in Auth\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails = [];

  // Create a map of users by email for quick lookup
  const usersByEmail = new Map();
  users.forEach(user => {
    if (user.email) {
      usersByEmail.set(user.email.toLowerCase(), user);
    }
  });

  // Update each auth user's display name
  for (const authUser of authUsers) {
    try {
      const user = usersByEmail.get(authUser.email?.toLowerCase());

      if (!user || !user.full_name) {
        skipped++;
        console.log(`⊘ Skipped: ${authUser.email} - No full_name in users table`);
        continue;
      }

      // Check if display name needs updating
      const currentDisplayName = authUser.user_metadata?.full_name || authUser.user_metadata?.display_name || '';

      if (currentDisplayName === user.full_name) {
        skipped++;
        console.log(`⊘ Already up to date: ${authUser.email} - ${user.full_name}`);
        continue;
      }

      // Update auth user metadata
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        authUser.id,
        {
          user_metadata: {
            ...authUser.user_metadata,
            full_name: user.full_name,
            display_name: user.full_name,
          },
        }
      );

      if (updateError) {
        errors++;
        const errorMsg = `Error updating ${authUser.email}: ${updateError.message}`;
        errorDetails.push(errorMsg);
        console.error(`✗ ${errorMsg}`);
      } else {
        updated++;
        console.log(`✓ Updated: ${authUser.email} -> ${user.full_name}`);
      }
    } catch (error) {
      errors++;
      const errorMsg = `Error processing ${authUser.email}: ${error.message}`;
      errorDetails.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("UPDATE SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total auth users: ${authUsers.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.forEach(err => console.log(`  - ${err}`));
  }

  console.log("\n" + "=".repeat(80));
}

// Run update
updateAuthDisplayNames()
  .then(() => {
    console.log("\n✅ Update completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Update failed:", error);
    process.exit(1);
  });
