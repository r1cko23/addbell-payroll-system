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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const excelFileArg = args.find(arg => !arg.startsWith("--"));

// Excel file path - use GP FILE UPDATED.xlsx
const excelFile = excelFileArg || path.join(__dirname, "..", "GP FILE UPDATED.xlsx");

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  process.exit(1);
}

// Helper function to determine OT group based on employee location/position
function determineOTGroup(location, position) {
  const locUpper = location?.toUpperCase() || '';
  const posUpper = position?.toUpperCase() || '';

  // Check NON HOTEL + ACCOUNT SUPERVISOR first (before HOTEL check)
  if (locUpper.includes('NON HOTEL') && posUpper.includes('ACCOUNT SUPERVISOR')) {
    return 'ACCOUNT SUPERVISOR FOR NON HOTEL';
  }

  // Check HOTEL (but not NON HOTEL)
  if (locUpper === 'HOTEL' || (locUpper.includes('HOTEL') && !locUpper.includes('NON'))) {
    return 'ACCOUNT SUPERVISOR FOR HOTEL';
  }

  // Office based employees (HEAD OFFICE and NON HOTEL)
  if (locUpper === 'HEAD OFFICE' || locUpper.includes('HEAD OFFICE') ||
      locUpper === 'NON HOTEL' || locUpper.includes('NON HOTEL')) {
    // Determine sub-group based on position
    // Check for managers/supervisors/heads/directors first (GP HEADS)
    if ((posUpper.includes('MANAGER') || posUpper.includes('HEAD') || 
         posUpper.includes('DIRECTOR') || posUpper.includes('SUPERVISOR')) &&
        !posUpper.includes('ACCOUNT SUPERVISOR')) {
      return 'GP HEADS';
    }
    
    // Check RECRUITMENT
    if (posUpper.includes('RECRUIT')) {
      return 'RECRUITMENT';
    }
    
    // Check ACCOUNTING (TIMEKEEPING, PAYROLL, BILLING, COLLECTION)
    // But exclude PAYROLL SUPERVISOR (should be GP HEADS)
    if ((posUpper.includes('ACCOUNTING') || posUpper.includes('TIMEKEEPING') || 
         posUpper.includes('PAYROLL') || posUpper.includes('BILLING') || 
         posUpper.includes('COLLECTION')) && !posUpper.includes('SUPERVISOR')) {
      return 'ACCOUNTING';
    }
    
    // Check HR COMPENSATION & BENEFITS
    if (posUpper.includes('COMPENSATION') || posUpper.includes('BENEFITS')) {
      return 'HR COMPENSATION & BENEFITS';
    }
    
    // Check DRIVERS
    if (posUpper.includes('DRIVER')) {
      return 'DRIVERS';
    }
    
    // Default for office based employees
    return 'HR & ADMIN';
  }

  return null;
}

async function main() {
  console.log("=".repeat(80));
  console.log("UPDATING EMPLOYEE GROUP ASSIGNMENTS FROM EXCEL");
  console.log("=".repeat(80));
  console.log(`Reading file: ${excelFile}\n`);

  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made to the database\n");
  }

  // Read Excel file
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    header: 1,
    range: 1,
  });

  const rows = data.slice(1).filter(row => row && row.length > 0 && row[0] != null && typeof row[0] === 'number');

  console.log(`Found ${rows.length} employee rows\n`);

  // Get OT groups
  const { data: otGroups, error: groupsError } = await supabase
    .from("overtime_groups")
    .select("id, name")
    .order("name");

  if (groupsError) throw groupsError;
  const groupMap = new Map(otGroups.map(g => [g.name, g.id]));
  console.log(`Found ${otGroups.length} OT groups:\n`);
  otGroups.forEach(g => console.log(`  - ${g.name}`));
  console.log();

  let updated = 0;
  let notFound = 0;
  let errors = 0;
  let unchanged = 0;
  const errorDetails = [];

  // Process each employee row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;

    const employeeId = row[0]?.toString().trim();
    const lastName = row[1]?.toString().trim() || '';
    const firstName = row[2]?.toString().trim() || '';
    const position = row[3]?.toString().trim() || '';
    const location = row[4]?.toString().trim() || '';

    // Determine OT group
    const otGroupName = determineOTGroup(location, position);
    if (!otGroupName) {
      console.warn(`⚠️  Skipping employee ${employeeId} (${firstName} ${lastName}) - Could not determine OT group`);
      continue;
    }

    const otGroupId = groupMap.get(otGroupName);
    if (!otGroupId) {
      console.warn(`⚠️  OT group not found: ${otGroupName} for employee ${employeeId}`);
      continue;
    }

    // Find employee by employee_id
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, overtime_group_id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (empError) {
      errors++;
      errorDetails.push(`Error finding employee ${employeeId}: ${empError.message}`);
      continue;
    }

    if (!employee) {
      notFound++;
      console.log(`⊘ Employee not found: ${employeeId} (${firstName} ${lastName})`);
      continue;
    }

    // Check if group assignment needs to be updated
    if (employee.overtime_group_id === otGroupId) {
      unchanged++;
      continue;
    }

    // Update employee's OT group
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("employees")
        .update({ overtime_group_id: otGroupId })
        .eq("id", employee.id);

      if (updateError) {
        errors++;
        errorDetails.push(`Error updating employee ${employeeId}: ${updateError.message}`);
        console.error(`✗ Error updating ${employee.full_name} (${employeeId}): ${updateError.message}`);
        continue;
      }
    }

    updated++;
    const currentGroup = employee.overtime_group_id ? otGroups.find(g => g.id === employee.overtime_group_id)?.name || 'Unknown' : 'Unassigned';
    console.log(`✓ ${dryRun ? "[DRY RUN] Would update" : "Updated"}: ${employee.full_name} (${employeeId})`);
    console.log(`  → From: ${currentGroup}`);
    console.log(`  → To: ${otGroupName}`);
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total employees processed: ${rows.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.forEach(err => console.log(`  - ${err}`));
  }

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => {
    console.log("\n✅ Process completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Process failed:", error);
    process.exit(1);
  });

