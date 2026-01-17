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

async function applyMigrationViaAPI() {
  console.log("Applying migration via Supabase REST API...\n");

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
    // Supabase doesn't expose a direct SQL execution endpoint via REST API
    // We need to use the PostgREST RPC function or execute via dashboard
    // However, we can try using the management API if available
    
    console.log("Attempting to execute migration SQL...\n");
    console.log("SQL to execute:");
    console.log("=".repeat(60));
    console.log(migrationSQL);
    console.log("=".repeat(60));
    console.log("\n");

    // Try using Supabase Management API (requires project ref and access token)
    // For now, we'll verify the column and provide instructions
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // Check if column exists by trying to query it
    console.log("Checking if column exists...");
    const { data, error } = await supabase
      .from("employee_loans")
      .select("deduct_bi_monthly")
      .limit(1);

    if (error) {
      if (error.code === "42703" || error.message?.includes("deduct_bi_monthly")) {
        console.log("❌ Column 'deduct_bi_monthly' does not exist");
        console.log("\n⚠️  Cannot execute raw SQL via Supabase JS client.");
        console.log("Please run the migration using one of these methods:\n");
        console.log("1. Supabase Dashboard SQL Editor:");
        console.log("   - Go to https://app.supabase.com");
        console.log("   - Select your project");
        console.log("   - Go to SQL Editor");
        console.log("   - Paste the SQL above and click RUN\n");
        console.log("2. Supabase CLI:");
        console.log(`   supabase db push --file ${migrationPath}\n`);
        console.log("3. Via MCP (if configured):");
        console.log("   Use the Supabase MCP server to execute the SQL\n");
        process.exit(1);
      } else {
        console.error("Error checking column:", error);
        process.exit(1);
      }
    } else {
      console.log("✅ Column 'deduct_bi_monthly' already exists!");
      console.log("✅ Migration already applied!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Error:", error);
    console.log("\nPlease run the migration manually in Supabase SQL Editor");
    process.exit(1);
  }
}

applyMigrationViaAPI();
