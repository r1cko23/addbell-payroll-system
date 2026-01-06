const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

// Excel file path - update this to your file location
const excelFile = process.argv[2] || path.join(
  __dirname,
  "..",
  "data",
  "ot-accounts.xlsx"
);

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  console.error("\nUsage: node scripts/import-ot-accounts-from-excel.js [path-to-excel-file]");
  console.error("\nExpected Excel format:");
  console.error("  Column A: Full Name (e.g., 'John Doe')");
  console.error("  Column B: Password (minimum 8 characters)");
  console.error("  Column C: Role (ot_approver or ot_viewer)");
  console.error("\nEmail will be auto-generated as: firstnamelastname@greenpasture.ph");
  console.error("Example: 'John Doe' -> 'johndoe@greenpasture.ph'");
  console.error("\nFirst row should be headers, data starts from row 2");
  process.exit(1);
}

// Read Excel file
const workbook = XLSX.readFile(excelFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Read with header row
const data = XLSX.utils.sheet_to_json(worksheet, {
  defval: null,
  header: 1,
  range: 1,
});

const headers = data[0] || [];
const rows = data.slice(1);

// Convert to objects with proper headers
// Try to auto-detect column names (case-insensitive)
const findColumn = (name, alternatives) => {
  const lowerHeaders = headers.map(h => h?.toString().toLowerCase().trim());
  const target = name.toLowerCase();
  const index = lowerHeaders.findIndex(h => 
    h === target || alternatives.some(alt => h === alt.toLowerCase())
  );
  return index >= 0 ? index : null;
};

const nameCol = findColumn("full name", ["name", "fullname", "full_name", "full name"]);
const passwordCol = findColumn("password", ["pwd", "pass"]);
const roleCol = findColumn("role", ["user role", "account role"]);

// If columns not found by name, try by position (A=0, B=1, C=2)
const nameIndex = nameCol !== null ? nameCol : 0;
const passwordIndex = passwordCol !== null ? passwordCol : 1;
const roleIndex = roleCol !== null ? roleCol : 2;

// Helper function to generate email from full name
function generateEmail(fullName) {
  // Split name into parts
  const nameParts = fullName.trim().split(/\s+/);
  
  if (nameParts.length < 2) {
    throw new Error("Full name must contain at least first name and last name");
  }
  
  // Get first name and last name
  const firstName = nameParts[0].toLowerCase().replace(/[^a-z]/g, '');
  const lastName = nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  
  // Combine: firstnamelastname@greenpasture.ph
  return `${firstName}${lastName}@greenpasture.ph`;
}

const excelAccounts = rows
  .map((row, idx) => {
    const fullName = row[nameIndex]?.toString().trim();
    const password = row[passwordIndex]?.toString().trim();
    const role = row[roleIndex]?.toString().trim().toLowerCase();

    if (!fullName || !password) {
      console.warn(`⚠️  Row ${idx + 2}: Missing required fields (Full Name or Password). Skipping.`);
      return null; // Skip incomplete rows
    }

    // Generate email from full name
    let email;
    try {
      email = generateEmail(fullName);
    } catch (error) {
      console.warn(`⚠️  Row ${idx + 2}: ${error.message}. Skipping.`);
      return null;
    }

    // Validate role
    const validRole = role === "ot_approver" || role === "ot_viewer" 
      ? role 
      : role === "approver" 
        ? "ot_approver"
        : role === "viewer"
          ? "ot_viewer"
          : null;

    if (!validRole) {
      console.warn(`⚠️  Row ${idx + 2}: Invalid role "${role}". Must be "ot_approver" or "ot_viewer". Skipping.`);
      return null;
    }

    // Validate password length
    if (password.length < 8) {
      console.warn(`⚠️  Row ${idx + 2}: Password too short (${password.length} chars). Minimum 8 characters required. Skipping.`);
      return null;
    }

    return {
      email: email.toLowerCase(),
      full_name: fullName,
      password: password,
      role: validRole,
    };
  })
  .filter((acc) => acc !== null);

console.log("=".repeat(80));
console.log("OT APPROVER/VIEWER ACCOUNTS IMPORT FROM EXCEL");
console.log("=".repeat(80));
console.log(`\nExcel file: ${excelFile}`);
console.log(`Total accounts in Excel: ${excelAccounts.length}`);

if (excelAccounts.length === 0) {
  console.error("\nNo valid accounts found in Excel file!");
  console.error("\nExpected format:");
  console.error("  Email | Full Name | Password | Role");
  console.error("  example@email.com | John Doe | password123 | ot_approver");
  process.exit(1);
}

// Helper function to create account
async function createAccount(accountData) {
  // Step 1: Create user in Supabase Auth
  const { data: authData, error: createAuthError } =
    await supabase.auth.admin.createUser({
      email: accountData.email,
      password: accountData.password,
      email_confirm: true, // Auto-confirm the user
      user_metadata: {
        full_name: accountData.full_name,
      },
    });

  if (createAuthError || !authData.user) {
    throw new Error(`Auth creation failed: ${createAuthError?.message || "Unknown error"}`);
  }

  // Step 2: Insert user into users table
  const { data: userData, error: userInsertError } = await supabase
    .from("users")
    .insert({
      id: authData.user.id,
      email: accountData.email,
      full_name: accountData.full_name,
      role: accountData.role,
      is_active: true,
    })
    .select()
    .single();

  if (userInsertError) {
    // If user table insert fails, try to clean up auth user
    try {
      await supabase.auth.admin.deleteUser(authData.user.id);
    } catch (cleanupError) {
      console.error(`  ⚠️  Failed to cleanup auth user: ${cleanupError.message}`);
    }
    throw new Error(`User table insert failed: ${userInsertError.message}`);
  }

  return userData;
}

async function importAccounts(dryRun = false) {
  if (dryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes will be made to the database\n");
  } else {
    console.log("\nStarting account creation process...\n");
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails = [];

  // Fetch existing users to check for duplicates
  console.log("Fetching existing users from database...");
  const { data: existingUsers, error: fetchError } = await supabase
    .from("users")
    .select("id, email");

  if (fetchError) {
    console.error("Error fetching existing users:", fetchError);
    process.exit(1);
  }

  const existingEmails = new Set(
    existingUsers.map((user) => user.email.toLowerCase())
  );

  console.log(`Found ${existingUsers.length} existing users in database\n`);

  // Process each account from Excel
  for (let i = 0; i < excelAccounts.length; i++) {
    const accountData = excelAccounts[i];

    try {
      // Check if email already exists
      if (existingEmails.has(accountData.email)) {
        skipped++;
        console.log(
          `⊘ Skipped (already exists): ${accountData.full_name} (${accountData.email})`
        );
        continue;
      }

      if (!dryRun) {
        await createAccount(accountData);
      }

      created++;
      console.log(
        `+ ${dryRun ? "[DRY RUN] Would create" : "Created"}: ${
          accountData.full_name
        } (${accountData.email}) - Role: ${accountData.role}`
      );
      if (dryRun) {
        console.log(`    Generated email: ${accountData.email}`);
      }
    } catch (error) {
      errors++;
      const errorMsg = `Error processing ${accountData.email} (${accountData.full_name}): ${error.message}`;
      errorDetails.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total accounts in Excel: ${excelAccounts.length}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("ERROR DETAILS:");
    console.log("=".repeat(80));
    errorDetails.forEach((err) => console.error(err));
  }

  console.log("\n" + "=".repeat(80));
  console.log("Import completed!");
  console.log("=".repeat(80));
}

// Check for dry-run flag
const dryRun =
  process.argv.includes("--dry-run") || process.argv.includes("-d");

// Run the import
importAccounts(dryRun)
  .then(() => {
    if (dryRun) {
      console.log(
        "\n⚠️  This was a dry run. Use without --dry-run to apply changes."
      );
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

