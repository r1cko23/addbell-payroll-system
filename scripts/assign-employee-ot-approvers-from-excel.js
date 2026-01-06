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
const excelFile = excelFileArg || path.join(__dirname, "..", "timelog approver.xlsx");

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  process.exit(1);
}

// Helper functions
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  return email.trim().toLowerCase().replace(/\s+/g, '');
}

function determineOTGroup(location, position) {
  const locUpper = location?.toUpperCase() || '';
  const posUpper = position?.toUpperCase() || '';

  if (locUpper === 'HOTEL' || locUpper.includes('HOTEL')) {
    return 'ACCOUNT SUPERVISOR FOR HOTEL';
  }

  if (locUpper === 'HEAD OFFICE' || locUpper.includes('HEAD OFFICE') ||
      locUpper === 'NON HOTEL' || locUpper.includes('NON HOTEL')) {
    if (posUpper.includes('RECRUIT')) {
      return 'RECRUITMENT';
    } else if (posUpper.includes('ACCOUNTING')) {
      return 'ACCOUNTING';
    } else if (posUpper.includes('MANAGER') || posUpper.includes('HEAD') || posUpper.includes('DIRECTOR')) {
      return 'GP HEADS';
    } else {
      return 'HR & ADMIN';
    }
  }

  return null;
}

async function main() {
  console.log("Reading Excel file...\n");

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
  console.log(`Found ${otGroups.length} OT groups\n`);

  // Get all users to map emails to IDs
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email")
    .in("role", ["ot_approver", "ot_viewer", "admin", "account_manager"]);

  if (usersError) throw usersError;
  const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u.id]));
  console.log(`Found ${users.length} users\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;
  const errorDetails = [];

  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made\n");
  }

  // Process each employee row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 6) continue;

    const employeeId = row[0]?.toString().trim();
    const lastName = row[1]?.toString().trim() || '';
    const firstName = row[2]?.toString().trim() || '';
    const position = row[3]?.toString().trim() || '';
    const location = row[4]?.toString().trim() || '';

    // Column 6 = OT Approver email
    const approverEmail = normalizeEmail(row[5]);
    // Columns 7-8 = OT Viewer emails
    const viewerEmail1 = normalizeEmail(row[6]);
    const viewerEmail2 = normalizeEmail(row[7]);

    // Determine OT group
    const otGroupName = determineOTGroup(location, position);
    if (!otGroupName) {
      console.warn(`⚠️  Skipping employee ${employeeId} (${firstName} ${lastName}) - Could not determine OT group`);
      continue;
    }

    const otGroupId = groupMap.get(otGroupName);
    if (!otGroupId) {
      console.warn(`⚠️  OT group not found: ${otGroupName}`);
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

    // Update employee's OT group
    const updates = {
      overtime_group_id: otGroupId,
    };

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("employees")
        .update(updates)
        .eq("id", employee.id);

      if (updateError) {
        errors++;
        errorDetails.push(`Error updating employee ${employeeId}: ${updateError.message}`);
        continue;
      }
    }

    updated++;
    console.log(`✓ ${dryRun ? "[DRY RUN] Would update" : "Updated"}: ${employee.full_name} (${employeeId})`);
    console.log(`  → OT Group: ${otGroupName}`);
    console.log(`  → Approver: ${approverEmail || 'N/A'}`);
    console.log(`  → Viewers: ${[viewerEmail1, viewerEmail2].filter(e => e).join(', ') || 'N/A'}`);
  }

  // Now update OT groups with approvers/viewers based on most common per group
  console.log("\n" + "=".repeat(80));
  console.log("UPDATING OT GROUPS WITH APPROVERS/VIEWERS");
  console.log("=".repeat(80));

  // Count approvers/viewers per group
  const groupApproverCounts = new Map();
  const groupViewerCounts = new Map();

  for (const row of rows) {
    if (!row || row.length < 6) continue;
    const location = row[4]?.toString().trim() || '';
    const position = row[3]?.toString().trim() || '';
    const otGroupName = determineOTGroup(location, position);
    if (!otGroupName) continue;

    const approverEmail = normalizeEmail(row[5]);
    const viewerEmail1 = normalizeEmail(row[6]);
    const viewerEmail2 = normalizeEmail(row[7]);

    if (approverEmail) {
      if (!groupApproverCounts.has(otGroupName)) {
        groupApproverCounts.set(otGroupName, new Map());
      }
      const counts = groupApproverCounts.get(otGroupName);
      counts.set(approverEmail, (counts.get(approverEmail) || 0) + 1);
    }

    [viewerEmail1, viewerEmail2].forEach(viewerEmail => {
      if (viewerEmail) {
        if (!groupViewerCounts.has(otGroupName)) {
          groupViewerCounts.set(otGroupName, new Map());
        }
        const counts = groupViewerCounts.get(otGroupName);
        counts.set(viewerEmail, (counts.get(viewerEmail) || 0) + 1);
      }
    });
  }

  // Assign most common approver/viewer to each group
  for (const [groupName, approverCounts] of groupApproverCounts.entries()) {
    const groupId = groupMap.get(groupName);
    if (!groupId) continue;

    // Special case: GP HEADS should use mgrazal if present
    let mostCommonApprover = null;
    if (groupName === 'GP HEADS' && approverCounts.has('mgrazal@greenpasture.ph')) {
      mostCommonApprover = 'mgrazal@greenpasture.ph';
    } else {
      let maxCount = 0;
      for (const [email, count] of approverCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonApprover = email;
        }
      }
    }

    if (mostCommonApprover) {
      const approverId = userEmailMap.get(mostCommonApprover);
      if (approverId) {
        if (!dryRun) {
          const { error } = await supabase
            .from("overtime_groups")
            .update({ approver_id: approverId })
            .eq("id", groupId);

          if (error) {
            console.error(`  ✗ Error updating ${groupName} approver: ${error.message}`);
          } else {
            console.log(`  ✓ ${groupName}: Approver = ${mostCommonApprover}`);
          }
        } else {
          console.log(`  ✓ [DRY RUN] ${groupName}: Would set Approver = ${mostCommonApprover}`);
        }
      }
    }
  }

  for (const [groupName, viewerCounts] of groupViewerCounts.entries()) {
    const groupId = groupMap.get(groupName);
    if (!groupId) continue;

    let maxCount = 0;
    let mostCommonViewer = null;
    for (const [email, count] of viewerCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonViewer = email;
      }
    }

    if (mostCommonViewer) {
      const viewerId = userEmailMap.get(mostCommonViewer);
      if (viewerId) {
        if (!dryRun) {
          const { error } = await supabase
            .from("overtime_groups")
            .update({ viewer_id: viewerId })
            .eq("id", groupId);

          if (error) {
            console.error(`  ✗ Error updating ${groupName} viewer: ${error.message}`);
          } else {
            console.log(`  ✓ ${groupName}: Viewer = ${mostCommonViewer}`);
          }
        } else {
          console.log(`  ✓ [DRY RUN] ${groupName}: Would set Viewer = ${mostCommonViewer}`);
        }
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total employees processed: ${rows.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.forEach(err => console.log(`  - ${err}`));
  }
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
