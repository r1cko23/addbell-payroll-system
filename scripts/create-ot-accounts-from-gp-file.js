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

// Email mapping for codes
const emailMap = {
  "MGR": "mgrazal@greenpasture.ph",
  // JON ALFECHE will be found via name matching (Andres Alfeche II -> andresii@greenpasture.ph)
  // Add more mappings as needed
};

// Name mapping for codes (when we know the exact name)
const nameMap = {
  "MGR": "Michelle Razal", // Based on mgrazal@greenpasture.ph
  "JON ALFECHE": "Andres Alfeche II", // Found in employee list
  "MICHAEL MAGBAG": "Michael Magbag",
  "MICHELLE RAZAL": "Michelle Razal",
  "LEA VALDEZ": "Lea Valdez",
  "CHERRYL REYES": "Cherryl Grace Reyes",
  "SHYNA AYA-AY": "Shyna Aya-Ay",
  "APRIL NIÑA GAMMAD": "April Niña Gammad",
  "RAQUEL RAZAL": "Raquel Razal",
  "REGINE MACABENTA": "Regine Macabenta",
  "APRIL": "April Niña Gammad",
};

// Helper function to generate email from full name
function generateEmail(fullName) {
  const nameParts = fullName.trim().split(/\s+/);

  if (nameParts.length < 2) {
    throw new Error("Full name must contain at least first name and last name");
  }

  const firstName = nameParts[0].toLowerCase().replace(/[^a-z]/g, '');
  const lastName = nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z]/g, '');

  return `${firstName}${lastName}@greenpasture.ph`;
}

// Helper function to find full name from code
function findFullNameFromCode(code, data) {
  // First check name map
  if (nameMap[code]) {
    return nameMap[code];
  }

  // Check if code is in email map and find matching name
  if (emailMap[code]) {
    const targetEmail = emailMap[code];
    // Try to find matching employee by email generation
    for (const row of data) {
      const lastName = row[1]?.toString().trim();
      const firstName = row[2]?.toString().trim();
      if (firstName && lastName) {
        const fullName = `${firstName} ${lastName}`.trim();
        const generatedEmail = generateEmail(fullName);
        if (generatedEmail === targetEmail) {
          return fullName;
        }
      }
    }
  }

  // Try fuzzy matching in employee list
  const codeUpper = code.toUpperCase();
  for (const row of data) {
    const lastName = row[1]?.toString().trim();
    const firstName = row[2]?.toString().trim();

    if (firstName && lastName) {
      const fullName = `${firstName} ${lastName}`.trim();
      const fullNameUpper = fullName.toUpperCase();
      const lastNameUpper = lastName.toUpperCase();
      const firstNameUpper = firstName.toUpperCase();

      // Check if code matches name patterns
      if (codeUpper === fullNameUpper ||
          codeUpper === `${firstNameUpper} ${lastNameUpper}` ||
          codeUpper.includes(lastNameUpper) ||
          codeUpper.includes(firstNameUpper) ||
          fullNameUpper.includes(codeUpper) ||
          (codeUpper.split(' ').length > 1 &&
           codeUpper.split(' ').every(part => fullNameUpper.includes(part)))) {
        return fullName;
      }
    }
  }

  return null;
}

// Read Excel file
const excelFile = process.argv[2] || "GP FILE.xlsx";

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  process.exit(1);
}

console.log("=".repeat(80));
console.log("OT APPROVER/VIEWER ACCOUNTS CREATION FROM GP FILE");
console.log("=".repeat(80));
console.log(`\nReading file: ${excelFile}`);

const workbook = XLSX.readFile(excelFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, {
  defval: null,
  header: 1,
  range: 1,
});

// Extract unique approvers and viewers
const approverCodes = new Set();
const viewerCodes = new Set();

data.slice(1).forEach((row) => {
  const approver = row[5]?.toString().trim();
  const viewer = row[6]?.toString().trim();

  if (approver && approver !== "APPROVER OF LEAVE") {
    approverCodes.add(approver);
  }
  if (viewer && viewer !== "VIEWING ONLY") {
    viewerCodes.add(viewer);
  }
});

console.log(`\nFound ${approverCodes.size} unique approver codes`);
console.log(`Found ${viewerCodes.size} unique viewer codes`);

// Map codes to full names and emails
const accountsToCreate = new Map(); // email -> {full_name, roles: Set}

// Process approvers
console.log("\nProcessing approvers...");
for (const code of approverCodes) {
  let fullName = findFullNameFromCode(code, data.slice(1));
  let email;

  if (emailMap[code]) {
    email = emailMap[code];
    if (!fullName) {
      // Try to find name from email prefix
      const emailPrefix = email.split('@')[0];
      for (const row of data.slice(1)) {
        const lastName = row[1]?.toString().trim();
        const firstName = row[2]?.toString().trim();
        if (firstName && lastName) {
          const testName = `${firstName} ${lastName}`.trim();
          if (generateEmail(testName) === email) {
            fullName = testName;
            break;
          }
        }
      }
    }
  } else if (fullName) {
    email = generateEmail(fullName);
  } else {
    console.warn(`⚠️  Could not find full name for approver code: ${code}`);
    continue;
  }

  if (email && fullName) {
    if (!accountsToCreate.has(email)) {
      accountsToCreate.set(email, { full_name: fullName, roles: new Set() });
    }
    accountsToCreate.get(email).roles.add("ot_approver");
    console.log(`  ✓ ${code} -> ${fullName} (${email}) - ot_approver`);
  }
}

// Process viewers
console.log("\nProcessing viewers...");
for (const code of viewerCodes) {
  let fullName = findFullNameFromCode(code, data.slice(1));
  let email;

  if (emailMap[code]) {
    email = emailMap[code];
    if (!fullName) {
      const emailPrefix = email.split('@')[0];
      for (const row of data.slice(1)) {
        const lastName = row[1]?.toString().trim();
        const firstName = row[2]?.toString().trim();
        if (firstName && lastName) {
          const testName = `${firstName} ${lastName}`.trim();
          if (generateEmail(testName) === email) {
            fullName = testName;
            break;
          }
        }
      }
    }
  } else if (fullName) {
    email = generateEmail(fullName);
  } else {
    console.warn(`⚠️  Could not find full name for viewer code: ${code}`);
    continue;
  }

  if (email && fullName) {
    if (!accountsToCreate.has(email)) {
      accountsToCreate.set(email, { full_name: fullName, roles: new Set() });
    }
    accountsToCreate.get(email).roles.add("ot_viewer");
    console.log(`  ✓ ${code} -> ${fullName} (${email}) - ot_viewer`);
  }
}

console.log(`\nTotal unique accounts to create: ${accountsToCreate.size}`);

// Helper function to create account
async function createAccount(accountData) {
  // Determine role - if person is both approver and viewer, make them approver
  const role = accountData.roles.has("ot_approver") ? "ot_approver" : "ot_viewer";

  // Generate password (use first 8 chars of email prefix + "123")
  const emailPrefix = accountData.email.split('@')[0];
  const password = `${emailPrefix}12345678`.substring(0, 16); // Ensure min 8 chars

  // Step 1: Create user in Supabase Auth
  const { data: authData, error: createAuthError } =
    await supabase.auth.admin.createUser({
      email: accountData.email,
      password: password,
      email_confirm: true,
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
      role: role,
      is_active: true,
    })
    .select()
    .single();

  if (userInsertError) {
    try {
      await supabase.auth.admin.deleteUser(authData.user.id);
    } catch (cleanupError) {
      console.error(`  ⚠️  Failed to cleanup auth user: ${cleanupError.message}`);
    }
    throw new Error(`User table insert failed: ${userInsertError.message}`);
  }

  return { userData, password };
}

async function createAccounts(dryRun = false) {
  if (dryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes will be made to the database\n");
  } else {
    console.log("\nStarting account creation process...\n");
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails = [];

  // Fetch existing users
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

  // Process each account
  for (const [email, accountData] of accountsToCreate.entries()) {
    try {
      if (existingEmails.has(email.toLowerCase())) {
        skipped++;
        console.log(`⊘ Skipped (already exists): ${accountData.full_name} (${email})`);
        continue;
      }

      const role = accountData.roles.has("ot_approver") ? "ot_approver" : "ot_viewer";
      const emailPrefix = email.split('@')[0];
      const password = `${emailPrefix}12345678`.substring(0, 16);

      if (!dryRun) {
        const { userData, password: createdPassword } = await createAccount({
          email,
          ...accountData,
        });
        console.log(`+ Created: ${accountData.full_name} (${email}) - Role: ${role}`);
        console.log(`  Password: ${createdPassword}`);
      } else {
        console.log(`+ [DRY RUN] Would create: ${accountData.full_name} (${email}) - Role: ${role}`);
        console.log(`  Password would be: ${password}`);
      }

      created++;
    } catch (error) {
      errors++;
      const errorMsg = `Error processing ${email} (${accountData.full_name}): ${error.message}`;
      errorDetails.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total accounts found: ${accountsToCreate.size}`);
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
const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-d");

// Run the import
createAccounts(dryRun)
  .then(() => {
    if (dryRun) {
      console.log("\n⚠️  This was a dry run. Use without --dry-run to apply changes.");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
