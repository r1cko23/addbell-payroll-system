/**
 * Fix OT Approver/Viewer User Names in Supabase Auth
 * 
 * Updates user names in both Supabase Auth and the users table
 * based on the correct names from the Excel file screenshots.
 */

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
    detectSessionInUrl: false,
  },
});

// Mapping of emails to correct full names based on screenshots
const nameMapping = {
  "mgrazal@greenpasture.ph": "MGR", // Mike Razal (MGR)
  "anngammad@greenpasture.ph": "APRIL", // April Nina Gammad
  "jonalfeche@greenpasture.ph": "JON ALFECHE",
  "mjmagbag@greenpasture.ph": "MICHAEL MAGBAG",
  "michrazal@greenpasture.ph": "MICHELLE RAZAL",
  "llvaldez@greenpasture.ph": "LEA VALDEZ",
  "cgpagulong@greenpasture.ph": "CHERRYL REYES", // Note: Email is cgpagulong but name is CHERRYL REYES
  "scaya-ay@greenpasture.ph": "SHYNA AYA-AY",
  "rarazal@greenpasture.ph": "RAQUEL RAZAL",
  "rmacabenta@greenpasture.ph": "REGINE MACABENTA",
};

// More detailed names (expanded from abbreviations)
const detailedNames = {
  "MGR": "Mike Razal",
  "APRIL": "April Nina Gammad",
  "JON ALFECHE": "Jon Alfeche",
  "MICHAEL MAGBAG": "Michael Magbag",
  "MICHELLE RAZAL": "Michelle Razal",
  "LEA VALDEZ": "Lea Valdez",
  "CHERRYL REYES": "Cherryl Reyes",
  "SHYNA AYA-AY": "Shyna Aya-Ay",
  "RAQUEL RAZAL": "Raquel Razal",
  "REGINE MACABENTA": "Regine Macabenta",
};

async function fixUserNames() {
  console.log("=".repeat(80));
  console.log("FIXING OT APPROVER/VIEWER USER NAMES");
  console.log("=".repeat(80));
  console.log();

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

  // Process each email in the mapping
  for (const [email, shortName] of Object.entries(nameMapping)) {
    try {
      const fullName = detailedNames[shortName] || shortName;
      const emailLower = email.toLowerCase();

      // Find auth user by email
      const authUser = authUsers.find(
        (u) => u.email?.toLowerCase() === emailLower
      );

      if (!authUser) {
        skipped++;
        console.log(`⊘ Skipped: ${email} - Not found in Auth`);
        continue;
      }

      // Check current name in users table
      const { data: dbUser, error: dbError } = await supabase
        .from("users")
        .select("id, email, full_name")
        .eq("id", authUser.id)
        .single();

      if (dbError) {
        errors++;
        const errorMsg = `Error fetching user ${email} from DB: ${dbError.message}`;
        errorDetails.push(errorMsg);
        console.error(`✗ ${errorMsg}`);
        continue;
      }

      // Update users table if name is different
      if (dbUser.full_name !== fullName) {
        const { error: updateDbError } = await supabase
          .from("users")
          .update({ full_name: fullName })
          .eq("id", authUser.id);

        if (updateDbError) {
          errors++;
          const errorMsg = `Error updating DB user ${email}: ${updateDbError.message}`;
          errorDetails.push(errorMsg);
          console.error(`✗ ${errorMsg}`);
          continue;
        }
        console.log(`✓ Updated DB: ${email} -> ${fullName}`);
      }

      // Update auth user metadata
      const currentDisplayName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.display_name ||
        "";

      if (currentDisplayName !== fullName) {
        const { data: updatedUser, error: updateError } =
          await supabase.auth.admin.updateUserById(authUser.id, {
            user_metadata: {
              ...authUser.user_metadata,
              full_name: fullName,
              display_name: fullName,
            },
          });

        if (updateError) {
          errors++;
          const errorMsg = `Error updating Auth user ${email}: ${updateError.message}`;
          errorDetails.push(errorMsg);
          console.error(`✗ ${errorMsg}`);
        } else {
          updated++;
          console.log(`✓ Updated Auth: ${email} -> ${fullName}`);
        }
      } else {
        skipped++;
        console.log(`⊘ Already correct: ${email} -> ${fullName}`);
      }
    } catch (error) {
      errors++;
      const errorMsg = `Error processing ${email}: ${error.message}`;
      errorDetails.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("UPDATE SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total users processed: ${Object.keys(nameMapping).length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.forEach((err) => console.log(`  - ${err}`));
  }

  console.log("\n" + "=".repeat(80));
}

// Run the script
fixUserNames()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

