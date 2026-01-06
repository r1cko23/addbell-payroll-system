/**
 * Assign Employee-Specific OT Approvers and Viewers from Excel
 *
 * Reads timelog approver.xlsx and assigns individual approvers/viewers
 * to each employee based on the Excel file data.
 */

const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");
const path = require("path");

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
    detectSessionInUrl: false,
  },
});

async function assignEmployeeSpecificApprovers(dryRun = false) {
  console.log("=".repeat(80));
  console.log("ASSIGNING EMPLOYEE-SPECIFIC OT APPROVERS AND VIEWERS");
  console.log("=".repeat(80));
  console.log(dryRun ? "(DRY RUN MODE - No changes will be made)\n" : "\n");

  // Read Excel file
  const excelFile = path.join(__dirname, "..", "timelog approver.xlsx");
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // Skip header row
  const rows = data.slice(1).filter((r) => r && r[0] && typeof r[0] === "number");

  console.log(`Found ${rows.length} employee rows in Excel\n`);

  // Get all users for email lookup
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email")
    .in("role", ["ot_approver", "ot_viewer", "admin", "account_manager"]);

  if (usersError) {
    console.error("Error fetching users:", usersError);
    process.exit(1);
  }

  const usersByEmail = new Map();
  users.forEach((user) => {
    if (user.email) {
      usersByEmail.set(user.email.toLowerCase(), user.id);
    }
  });

  console.log(`Found ${usersByEmail.size} users for assignment\n`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails = [];

  // Process each employee row
  for (const row of rows) {
    try {
      const employeeId = row[0].toString();
      const approverEmail = (row[5] || "").toString().trim().toLowerCase();
      const viewer1Email = (row[6] || "").toString().trim().toLowerCase();
      const viewer2Email = (row[7] || "").toString().trim().toLowerCase();

      // Get employee from database
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .eq("employee_id", employeeId)
        .single();

      if (empError || !employee) {
        skipped++;
        console.log(`⊘ Skipped: Employee ${employeeId} - Not found in database`);
        continue;
      }

      // Find approver user ID
      let approverId = null;
      if (approverEmail && approverEmail.includes("@")) {
        approverId = usersByEmail.get(approverEmail);
        if (!approverId) {
          errors++;
          const errorMsg = `Employee ${employeeId}: Approver email ${approverEmail} not found`;
          errorDetails.push(errorMsg);
          console.error(`✗ ${errorMsg}`);
          continue;
        }
      }

      // Find viewer user ID (use first viewer, or second if first is empty)
      let viewerId = null;
      const viewerEmail = viewer1Email || viewer2Email;
      if (viewerEmail && viewerEmail.includes("@")) {
        viewerId = usersByEmail.get(viewerEmail);
        if (!viewerId) {
          // Viewer not found is not critical, just log it
          console.log(
            `  ⚠️  Employee ${employeeId}: Viewer email ${viewerEmail} not found, skipping viewer assignment`
          );
        }
      }

      // Update employee with approver/viewer
      if (!dryRun) {
        const updateData = {
          overtime_approver_id: approverId,
          overtime_viewer_id: viewerId,
        };

        const { error: updateError } = await supabase
          .from("employees")
          .update(updateData)
          .eq("id", employee.id);

        if (updateError) {
          errors++;
          const errorMsg = `Employee ${employeeId} (${employee.full_name}): ${updateError.message}`;
          errorDetails.push(errorMsg);
          console.error(`✗ ${errorMsg}`);
          continue;
        }
      }

      updated++;
      const approverName = approverEmail.split("@")[0];
      const viewerName = viewerEmail ? viewerEmail.split("@")[0] : "none";
      console.log(
        `✓ ${employee.full_name.padEnd(35)} | Approver: ${approverName.padEnd(25)} | Viewer: ${viewerName}`
      );
      processed++;
    } catch (error) {
      errors++;
      const errorMsg = `Error processing row: ${error.message}`;
      errorDetails.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("ASSIGNMENT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total employees processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.slice(0, 10).forEach((err) => console.log(`  - ${err}`));
    if (errorDetails.length > 10) {
      console.log(`  ... and ${errorDetails.length - 10} more errors`);
    }
  }

  console.log("\n" + "=".repeat(80));
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

// Run the script
assignEmployeeSpecificApprovers(dryRun)
  .then(() => {
    console.log(dryRun ? "\n✅ Dry run completed successfully" : "\n✅ Assignment completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });