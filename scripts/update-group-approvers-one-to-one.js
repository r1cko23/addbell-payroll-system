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

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const excelFileArg = args.find(arg => !arg.startsWith("--"));

// Excel file path - use GP FILE UPDATED.xlsx
const excelFile = excelFileArg || path.join(__dirname, "..", "GP FILE UPDATED.xlsx");

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  console.error("\nUsage: node scripts/update-group-approvers-one-to-one.js [path-to-excel-file] [--dry-run]");
  process.exit(1);
}

// Helper function to normalize email
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  return email.trim().toLowerCase().replace(/\s+/g, '');
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
    if (posUpper.includes('MANAGER') || posUpper.includes('HEAD') ||
        posUpper.includes('DIRECTOR') || posUpper.includes('SUPERVISOR')) {
      // But exclude ACCOUNT SUPERVISOR (already handled above)
      if (!posUpper.includes('ACCOUNT SUPERVISOR')) {
        return 'GP HEADS';
      }
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
  console.log("UPDATING GROUP APPROVERS - ONE APPROVER PER GROUP");
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

  const headers = data[0] || [];
  const rows = data.slice(1).filter(row => row && row.length > 0 && row[0] != null && typeof row[0] === 'number');

  console.log("Headers:", headers);
  console.log(`Found ${rows.length} employee rows\n`);

  // Get OT groups
  const { data: otGroups, error: groupsError } = await supabase
    .from("overtime_groups")
    .select("id, name")
    .order("name");

  if (groupsError) throw groupsError;
  const groupMap = new Map(otGroups.map(g => [g.name, g.id]));
  console.log(`Found ${otGroups.length} existing OT groups:\n`);
  otGroups.forEach(g => console.log(`  - ${g.name}`));
  console.log();

  // Find all groups that should exist based on Excel data
  const requiredGroups = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    const location = row[4]?.toString().trim() || '';
    const position = row[3]?.toString().trim() || '';
    const groupName = determineOTGroup(location, position);
    if (groupName) {
      requiredGroups.add(groupName);
    }
  }

  console.log(`Required groups from Excel:\n`);
  Array.from(requiredGroups).sort().forEach(g => console.log(`  - ${g}`));
  console.log();

  // Create missing groups
  const missingGroups = Array.from(requiredGroups).filter(g => !groupMap.has(g));
  if (missingGroups.length > 0) {
    console.log(`Creating ${missingGroups.length} missing group(s):\n`);
    for (const groupName of missingGroups) {
      if (!dryRun) {
        const { data: newGroup, error: createError } = await supabase
          .from("overtime_groups")
          .insert({
            name: groupName,
            description: `Overtime group for ${groupName}`,
            is_active: true,
          })
          .select()
          .single();

        if (createError) {
          console.error(`  ✗ Failed to create group ${groupName}: ${createError.message}`);
        } else {
          console.log(`  ✓ Created group: ${groupName}`);
          groupMap.set(groupName, newGroup.id);
          otGroups.push(newGroup);
        }
      } else {
        console.log(`  [DRY RUN] Would create group: ${groupName}`);
        // Add a placeholder for dry run
        groupMap.set(groupName, `dry-run-${groupName}`);
      }
    }
    console.log();
  } else {
    console.log(`✓ All required groups already exist\n`);
  }

  // Get all users to map emails to IDs (include all users, not just approvers)
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, full_name, role");

  if (usersError) throw usersError;
  const userEmailMap = new Map(users.map(u => [u.email.toLowerCase(), u]));
  console.log(`Found ${users.length} existing users\n`);

  // Get employees to find names for approvers
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, email");

  if (!empError && employees) {
    const employeeEmailMap = new Map();
    employees.forEach(emp => {
      if (emp.email) {
        employeeEmailMap.set(emp.email.toLowerCase(), emp.full_name);
      }
    });
    console.log(`Found ${employees.length} employees for name lookup\n`);
  }

  // Helper function to get or create user
  async function getOrCreateUser(email, fullName) {
    // Check if user exists in users table
    const existingUser = userEmailMap.get(email.toLowerCase());
    if (existingUser) {
      return { user: existingUser, created: false };
    }

    // Check if user exists in Auth but not in users table
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (authUser) {
        // User exists in Auth but not in users table - create users table entry
        const { data: userData, error: userInsertError } = await supabase
          .from("users")
          .insert({
            id: authUser.id,
            email: email,
            full_name: fullName || authUser.user_metadata?.full_name || email.split('@')[0],
            role: 'approver',
            is_active: true,
          })
          .select()
          .single();

        if (userInsertError) {
          throw new Error(`User table insert failed: ${userInsertError.message}`);
        }

        userEmailMap.set(email.toLowerCase(), userData);
        return { user: userData, created: false, wasOrphaned: true };
      }
    } catch (authError) {
      console.warn(`  ⚠️  Could not check Auth users: ${authError.message}`);
    }

    // User doesn't exist, create in Auth first
    const emailPrefix = email.split('@')[0];
    const password = `${emailPrefix}12345678`.substring(0, 16);

    const { data: authData, error: createAuthError } =
      await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || email.split('@')[0],
          display_name: fullName || email.split('@')[0],
        },
      });

    if (createAuthError || !authData.user) {
      throw new Error(`Auth creation failed: ${createAuthError?.message || "Unknown error"}`);
    }

    // Create user in users table
    const { data: userData, error: userInsertError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        email: email,
        full_name: fullName || email.split('@')[0],
        role: 'approver',
        is_active: true,
      })
      .select()
      .single();

    if (userInsertError) {
      // Cleanup auth user if user table insert fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error(`  ⚠️  Failed to cleanup auth user: ${cleanupError.message}`);
      }
      throw new Error(`User table insert failed: ${userInsertError.message}`);
    }

    userEmailMap.set(email.toLowerCase(), userData);
    return { user: userData, created: true, password };
  }

  // Map to count how many times each approver appears for each group
  // Key: groupName, Value: Map<email, count>
  const groupApproverCounts = new Map();
  const groupViewerCounts = new Map();

  // Process each employee row
  // Column 0 = Employee ID
  // Column 1 = Last Name
  // Column 2 = First Name
  // Column 3 = Position
  // Column 4 = Location
  // Column 5 = OT Approver Email
  // Columns 6-7 = OT Viewer Emails
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 6) continue;

    const employeeId = row[0]?.toString().trim();
    const lastName = row[1]?.toString().trim() || '';
    const firstName = row[2]?.toString().trim() || '';
    const position = row[3]?.toString().trim() || '';
    const location = row[4]?.toString().trim() || '';

    // Column 5 = OT Approver email
    const approverEmail = normalizeEmail(row[5]);
    // Columns 6-7 = OT Viewer emails
    const viewerEmail1 = normalizeEmail(row[6]);
    const viewerEmail2 = normalizeEmail(row[7]);

    // Determine OT group based on employee location/position
    const otGroupName = determineOTGroup(location, position);
    if (!otGroupName) {
      console.warn(`⚠️  Skipping employee ${employeeId} (${firstName} ${lastName}) - Could not determine OT group`);
      continue;
    }

    // Count approver occurrences for each group
    if (approverEmail && approverEmail.includes('@')) {
      if (!groupApproverCounts.has(otGroupName)) {
        groupApproverCounts.set(otGroupName, new Map());
      }
      const counts = groupApproverCounts.get(otGroupName);
      counts.set(approverEmail, (counts.get(approverEmail) || 0) + 1);
    }

    // Count viewer occurrences for each group
    [viewerEmail1, viewerEmail2].forEach(viewerEmail => {
      if (viewerEmail && viewerEmail.includes('@')) {
        if (!groupViewerCounts.has(otGroupName)) {
          groupViewerCounts.set(otGroupName, new Map());
        }
        const counts = groupViewerCounts.get(otGroupName);
        counts.set(viewerEmail, (counts.get(viewerEmail) || 0) + 1);
      }
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("ANALYZING APPROVER ASSIGNMENTS");
  console.log("=".repeat(80));

  // First pass: Find the most common approver for each group
  // Then resolve conflicts to ensure one approver per group
  const groupToApprover = new Map(); // groupName -> approverEmail
  const approverToGroupCounts = new Map(); // approverEmail -> Map<groupName, count>

  // Collect all approver counts per group
  for (const [groupName, approverCounts] of groupApproverCounts.entries()) {
    for (const [email, count] of approverCounts.entries()) {
      if (!approverToGroupCounts.has(email)) {
        approverToGroupCounts.set(email, new Map());
      }
      approverToGroupCounts.get(email).set(groupName, count);
    }
  }

  // Assign approvers to groups, ensuring one-to-one mapping
  // Strategy: For each group, pick the approver that appears most frequently in that group
  // If an approver is already assigned, skip them for other groups
  const assignedApprovers = new Set(); // Track which approvers are already assigned

  // Sort groups by priority (GP HEADS first, then others)
  const sortedGroups = Array.from(groupApproverCounts.keys()).sort((a, b) => {
    if (a === 'GP HEADS') return -1;
    if (b === 'GP HEADS') return 1;
    return a.localeCompare(b);
  });

  for (const groupName of sortedGroups) {
    const approverCounts = groupApproverCounts.get(groupName);
    if (!approverCounts || approverCounts.size === 0) continue;

    let bestApprover = null;
    let bestCount = 0;

    // Special handling for GP HEADS - prioritize mgrazal if present
    if (groupName === 'GP HEADS' && approverCounts.has('mgrazal@greenpasture.ph')) {
      const mgrazalCount = approverCounts.get('mgrazal@greenpasture.ph');
      if (!assignedApprovers.has('mgrazal@greenpasture.ph')) {
        bestApprover = 'mgrazal@greenpasture.ph';
        bestCount = mgrazalCount;
      }
    }

    // If no special case or special case approver already assigned, find best available
    if (!bestApprover) {
      for (const [email, count] of approverCounts.entries()) {
        if (!assignedApprovers.has(email) && count > bestCount) {
          bestCount = count;
          bestApprover = email;
        }
      }
    }

    if (bestApprover) {
      groupToApprover.set(groupName, bestApprover);
      assignedApprovers.add(bestApprover);
    }
  }

  // Build reverse map for reporting
  const approverToGroup = new Map();
  for (const [groupName, approverEmail] of groupToApprover.entries()) {
    approverToGroup.set(approverEmail, groupName);
  }

  // Find the most common viewer for each group
  const groupToViewer = new Map(); // groupName -> viewerEmail
  const viewerToGroup = new Map(); // viewerEmail -> groupName

  for (const [groupName, viewerCounts] of groupViewerCounts.entries()) {
    let maxCount = 0;
    let mostCommonViewer = null;
    for (const [email, count] of viewerCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonViewer = email;
      }
    }

    if (mostCommonViewer) {
      groupToViewer.set(groupName, mostCommonViewer);
      viewerToGroup.set(mostCommonViewer, groupName);
    }
  }

  console.log("\nProposed group assignments:");
  for (const group of otGroups) {
    const approverEmail = groupToApprover.get(group.name);
    const viewerEmail = groupToViewer.get(group.name);
    console.log(`\n${group.name}:`);
    if (approverEmail) {
      const user = userEmailMap.get(approverEmail);
      console.log(`  Approver: ${user?.full_name || approverEmail} (${approverEmail})`);
    } else {
      console.log(`  Approver: NONE`);
    }
    if (viewerEmail) {
      const user = userEmailMap.get(viewerEmail);
      console.log(`  Viewer: ${user?.full_name || viewerEmail} (${viewerEmail})`);
    } else {
      console.log(`  Viewer: NONE`);
    }
  }

  // Verify one-to-one mapping
  console.log("\n" + "=".repeat(80));
  console.log("VERIFYING ONE-TO-ONE MAPPING");
  console.log("=".repeat(80));

  // Check for any remaining conflicts (shouldn't happen with our logic, but verify)
  const approverConflicts = [];
  for (const [approverEmail, groupName] of approverToGroup.entries()) {
    // Check if this approver appears in other groups
    for (const [otherGroupName, otherApproverEmail] of groupToApprover.entries()) {
      if (otherGroupName !== groupName && otherApproverEmail === approverEmail) {
        approverConflicts.push({
          approver: approverEmail,
          assignedTo: groupName,
          alsoIn: otherGroupName
        });
      }
    }
  }

  if (approverConflicts.length > 0) {
    console.warn("\n⚠️  WARNING: Conflicts detected (this shouldn't happen):");
    approverConflicts.forEach(conflict => {
      console.warn(`  ${conflict.approver}:`);
      console.warn(`    Assigned to: ${conflict.assignedTo}`);
      console.warn(`    Also appears in: ${conflict.alsoIn}`);
    });
  } else {
    console.log("\n✓ One-to-one mapping verified - each approver is assigned to exactly one group");
  }

  // Show which approvers appear in multiple groups but were assigned to only one
  console.log("\nApprover assignment summary:");
  const approversInMultipleGroups = [];
  for (const [approverEmail, groupCounts] of approverToGroupCounts.entries()) {
    if (groupCounts.size > 1) {
      const assignedGroup = approverToGroup.get(approverEmail);
      const allGroups = Array.from(groupCounts.keys());
      approversInMultipleGroups.push({
        email: approverEmail,
        assignedTo: assignedGroup || 'NONE',
        appearedIn: allGroups,
        counts: Object.fromEntries(groupCounts)
      });
    }
  }

  if (approversInMultipleGroups.length > 0) {
    console.log("\nApprovers that appeared in multiple groups (assigned to primary group only):");
    approversInMultipleGroups.forEach(info => {
      console.log(`\n  ${info.email}:`);
      console.log(`    Assigned to: ${info.assignedTo}`);
      console.log(`    Appeared in: ${info.appearedIn.join(', ')}`);
      console.log(`    Counts: ${JSON.stringify(info.counts)}`);
    });
  } else {
    console.log("\n✓ All approvers appear in only one group");
  }

  // Update database
  console.log("\n" + "=".repeat(80));
  console.log("UPDATING DATABASE");
  console.log("=".repeat(80));

  // First, clear all existing approver/viewer assignments
  if (!dryRun) {
    console.log("\nClearing existing assignments...");
    // Update each group individually to clear assignments
    for (const group of otGroups) {
      const { error: clearError } = await supabase
        .from("overtime_groups")
        .update({ approver_id: null, viewer_id: null })
        .eq("id", group.id);

      if (clearError) {
        console.warn(`⚠️  Error clearing assignments for ${group.name}: ${clearError.message}`);
      }
    }
    console.log("✓ Cleared all existing assignments\n");
  } else {
    console.log("\n[DRY RUN] Would clear all existing assignments\n");
  }

  let updated = 0;
  let notFound = 0;
  let created = 0;
  let errors = 0;
  const errorDetails = [];

  // Update each group with its assigned approver and viewer
  for (const group of otGroups) {
    const approverEmail = groupToApprover.get(group.name);
    const viewerEmail = groupToViewer.get(group.name);

    const updateData = {};

    if (approverEmail) {
      let approverUser = userEmailMap.get(approverEmail);

      // Always update role to 'approver' for assigned approvers (unless they're admin or hr)
      if (approverUser) {
        const currentRole = approverUser.role;
        if (currentRole !== 'approver' && currentRole !== 'admin' && currentRole !== 'hr') {
          if (!dryRun) {
            const { error: roleError } = await supabase
              .from("users")
              .update({ role: 'approver' })
              .eq("id", approverUser.id);

            if (roleError) {
              console.warn(`⚠️  Failed to update role for ${approverEmail}: ${roleError.message}`);
            } else {
              approverUser.role = 'approver';
              console.log(`✓ Updated role to approver: ${approverUser.full_name || approverEmail} (was: ${currentRole || 'unknown'})`);
            }
          } else {
            console.log(`[DRY RUN] Would update role to approver: ${approverUser.full_name || approverEmail} (current: ${currentRole || 'unknown'})`);
          }
        } else if (currentRole === 'admin' || currentRole === 'hr') {
          console.log(`⊘ Keeping role ${currentRole} for ${approverUser.full_name || approverEmail} (admin/hr roles are preserved)`);
        } else {
          console.log(`⊘ Role already set to approver: ${approverUser.full_name || approverEmail}`);
        }
      }

      // If user doesn't exist, try to create them
      if (!approverUser) {
        // Try to find name from employees table
        let approverName = null;
        if (employees) {
          const emp = employees.find(e => e.email && e.email.toLowerCase() === approverEmail.toLowerCase());
          if (emp) {
            approverName = emp.full_name;
          }
        }

        if (!dryRun) {
          try {
            const result = await getOrCreateUser(approverEmail, approverName);
            approverUser = result.user;
            if (result.created) {
              created++;
              console.log(`+ Created user: ${approverUser.full_name || approverEmail} (${approverEmail})`);
              console.log(`  → Role: approver`);
              if (result.password) {
                console.log(`  → Password: ${result.password}`);
              }
            } else {
              // User was created but might need role update
              if (approverUser.role !== 'approver' && approverUser.role !== 'admin' && approverUser.role !== 'hr') {
                const { error: roleError } = await supabase
                  .from("users")
                  .update({ role: 'approver' })
                  .eq("id", approverUser.id);

                if (!roleError) {
                  approverUser.role = 'approver';
                  console.log(`  → Updated role to approver`);
                }
              }
            }
          } catch (error) {
            notFound++;
            errorDetails.push(`Failed to create approver ${approverEmail} for group ${group.name}: ${error.message}`);
            console.warn(`⚠️  Failed to create approver ${approverEmail} for group ${group.name}: ${error.message}`);
          }
        } else {
          console.log(`[DRY RUN] Would create user: ${approverEmail} with role: approver`);
        }
      }

      if (approverUser) {
        updateData.approver_id = approverUser.id;
      } else if (!dryRun) {
        notFound++;
        errorDetails.push(`Approver not found: ${approverEmail} for group ${group.name}`);
        console.warn(`⚠️  Approver not found: ${approverEmail} for group ${group.name}`);
      }
    }

    if (viewerEmail) {
      let viewerUser = userEmailMap.get(viewerEmail);

      // If user doesn't exist, try to create them
      if (!viewerUser) {
        // Try to find name from employees table
        let viewerName = null;
        if (employees) {
          const emp = employees.find(e => e.email && e.email.toLowerCase() === viewerEmail.toLowerCase());
          if (emp) {
            viewerName = emp.full_name;
          }
        }

        if (!dryRun) {
          try {
            const result = await getOrCreateUser(viewerEmail, viewerName);
            viewerUser = result.user;
            if (result.created) {
              created++;
              console.log(`+ Created user: ${viewerUser.full_name || viewerEmail} (${viewerEmail})`);
              if (result.password) {
                console.log(`  → Password: ${result.password}`);
              }
            }
          } catch (error) {
            notFound++;
            errorDetails.push(`Failed to create viewer ${viewerEmail} for group ${group.name}: ${error.message}`);
            console.warn(`⚠️  Failed to create viewer ${viewerEmail} for group ${group.name}: ${error.message}`);
          }
        } else {
          console.log(`[DRY RUN] Would create user: ${viewerEmail}`);
        }
      }

      if (viewerUser) {
        updateData.viewer_id = viewerUser.id;
      } else if (!dryRun) {
        notFound++;
        errorDetails.push(`Viewer not found: ${viewerEmail} for group ${group.name}`);
        console.warn(`⚠️  Viewer not found: ${viewerEmail} for group ${group.name}`);
      }
    }

    if (Object.keys(updateData).length > 0) {
      if (!dryRun) {
        const { error } = await supabase
          .from("overtime_groups")
          .update(updateData)
          .eq("id", group.id);

        if (error) {
          errors++;
          errorDetails.push(`Error updating group ${group.name}: ${error.message}`);
          console.error(`✗ Error updating ${group.name}: ${error.message}`);
        } else {
          updated++;
          const approverName = approverEmail ? userEmailMap.get(approverEmail)?.full_name || approverEmail : 'NONE';
          const viewerName = viewerEmail ? userEmailMap.get(viewerEmail)?.full_name || viewerEmail : 'NONE';
          console.log(`✓ Updated ${group.name}:`);
          console.log(`    Approver: ${approverName}`);
          console.log(`    Viewer: ${viewerName}`);
        }
      } else {
        updated++;
        const approverName = approverEmail ? userEmailMap.get(approverEmail)?.full_name || approverEmail : 'NONE';
        const viewerName = viewerEmail ? userEmailMap.get(viewerEmail)?.full_name || viewerEmail : 'NONE';
        console.log(`✓ [DRY RUN] Would update ${group.name}:`);
        console.log(`    Approver: ${approverName}`);
        console.log(`    Viewer: ${viewerName}`);
      }
    } else {
      console.log(`⊘ Skipping ${group.name} - No approver or viewer assigned`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total groups processed: ${otGroups.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Created: ${created}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.forEach(err => console.log(`  - ${err}`));
  }

  console.log("\n" + "=".repeat(80));
  console.log("ONE-TO-ONE MAPPING VERIFICATION");
  console.log("=".repeat(80));

  // Final verification - check database state
  if (!dryRun) {
    const { data: finalGroups, error: finalError } = await supabase
      .from("overtime_groups")
      .select("id, name, approver_id, viewer_id, approver:users!overtime_groups_approver_id_fkey(email, full_name), viewer:users!overtime_groups_viewer_id_fkey(email, full_name)")
      .order("name");

    if (!finalError && finalGroups) {
      console.log("\nFinal group assignments:");
      for (const group of finalGroups) {
        console.log(`\n${group.name}:`);
        if (group.approver) {
          console.log(`  Approver: ${group.approver.full_name} (${group.approver.email})`);
        } else {
          console.log(`  Approver: NONE`);
        }
        if (group.viewer) {
          console.log(`  Viewer: ${group.viewer.full_name} (${group.viewer.email})`);
        } else {
          console.log(`  Viewer: NONE`);
        }
      }

      // Check for duplicate approvers
      const approverGroups = new Map();
      for (const group of finalGroups) {
        if (group.approver_id) {
          if (approverGroups.has(group.approver_id)) {
            console.warn(`\n⚠️  WARNING: Approver ${group.approver.email} is assigned to multiple groups:`);
            console.warn(`    - ${approverGroups.get(group.approver_id)}`);
            console.warn(`    - ${group.name}`);
          } else {
            approverGroups.set(group.approver_id, group.name);
          }
        }
      }
    }
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