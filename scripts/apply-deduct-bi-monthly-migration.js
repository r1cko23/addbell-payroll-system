const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
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

async function applyMigration() {
  console.log("Applying migration: Add deduct_bi_monthly column to employee_loans\n");

  // Read the migration SQL file
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "146_add_deduct_bi_monthly_to_loans.sql"
  );

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, "utf8");

  try {
    // Execute the migration SQL using RPC or direct query
    // Note: Supabase JS client doesn't support raw SQL execution directly
    // We need to use the REST API or break it into individual operations
    
    console.log("Step 1: Adding deduct_bi_monthly column...");
    
    // Check if column already exists
    const { data: columnCheck, error: checkError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employee_loans' 
        AND column_name = 'deduct_bi_monthly'
      `
    });

    if (checkError) {
      // RPC might not exist, try direct approach
      console.log("RPC not available, using direct SQL execution via REST API...");
      
      // Use the REST API to execute SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ sql: migrationSQL }),
      });

      if (!response.ok) {
        // If RPC doesn't work, we'll need to execute via Supabase dashboard
        console.error("\n❌ Cannot execute SQL directly via API.");
        console.error("Please run this migration manually in Supabase SQL Editor:\n");
        console.log("=".repeat(60));
        console.log(migrationSQL);
        console.log("=".repeat(60));
        console.log("\nOr use the Supabase CLI:");
        console.log(`supabase db push --file ${migrationPath}`);
        process.exit(1);
      }

      const result = await response.json();
      console.log("✅ Migration applied successfully!");
      console.log(result);
    } else {
      if (columnCheck && columnCheck.length > 0) {
        console.log("✅ Column 'deduct_bi_monthly' already exists!");
      } else {
        // Execute migration using individual statements
        console.log("Executing migration statements...");
        
        // Split SQL into individual statements
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            // Note: We can't execute raw SQL via Supabase JS client
            // This requires manual execution or Supabase CLI
          }
        }

        console.log("\n⚠️  Cannot execute raw SQL via Supabase JS client.");
        console.log("Please run this migration manually:\n");
        console.log("=".repeat(60));
        console.log(migrationSQL);
        console.log("=".repeat(60));
      }
    }

    // Verify the column was added
    console.log("\nVerifying column exists...");
    const { data: verifyData, error: verifyError } = await supabase
      .from("employee_loans")
      .select("deduct_bi_monthly")
      .limit(1);

    if (verifyError) {
      if (verifyError.code === "42703" || verifyError.message?.includes("deduct_bi_monthly")) {
        console.log("❌ Column verification failed - column does not exist yet");
        console.log("\nPlease run the migration SQL manually in Supabase SQL Editor");
      } else {
        console.error("Verification error:", verifyError);
      }
    } else {
      console.log("✅ Column 'deduct_bi_monthly' verified successfully!");
      console.log("✅ Migration complete!");
    }
  } catch (error) {
    console.error("Error applying migration:", error);
    console.log("\nPlease run this migration manually in Supabase SQL Editor:\n");
    console.log("=".repeat(60));
    console.log(migrationSQL);
    console.log("=".repeat(60));
    process.exit(1);
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log("\n✅ Script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
