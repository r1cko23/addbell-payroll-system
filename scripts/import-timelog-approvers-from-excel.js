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

// Excel file path
const excelFile = excelFileArg || path.join(__dirname, "..", "timelog approver.xlsx");

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  console.error("\nUsage: node scripts/import-timelog-approvers-from-excel.js [path-to-excel-file] [--dry-run]");
  process.exit(1);
}

// Read Excel file
const workbook = XLSX.readFile(excelFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Read data
const data = XLSX.utils.sheet_to_json(worksheet, {
  defval: null,
  header: 1,
  range: 1,
});

const headers = data[0] || [];
const rows = data.slice(1).filter(row => row && row.length > 0 && row[0] != null); // Filter empty rows

console.log("Headers:", headers);
console.log(`\nTotal employee rows (after filtering empty): ${rows.length}\n`);

// Map to store approvers/viewers and their assigned groups
// Key: email (lowercase), Value: { email, full_name, roles: Set, approver_groups: Set, viewer_groups: Set }
const userMap = new Map();

// Map to count how many times each approver/viewer appears for each group
// Key: groupName, Value: { approvers: Map<email, count>, viewers: Map<email, count> }
const groupApproverCounts = new Map();
const groupViewerCounts = new Map();

// Get OT groups mapping
async function getOTGroups() {
  const { data: groups, error } = await supabase
    .from("overtime_groups")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return groups || [];
}

// Helper function to normalize email
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  return email.trim().toLowerCase().replace(/\s+/g, '');
}

// Helper function to determine OT group based on employee location/position
// Column 5 = Location: HEAD OFFICE (office based), NON HOTEL (office based), HOTEL (client based)
function determineOTGroup(location, position) {
  const locUpper = location?.toUpperCase() || '';
  const posUpper = position?.toUpperCase() || '';
  
  // Client based employees
  if (locUpper === 'HOTEL' || locUpper.includes('HOTEL')) {
    return 'ACCOUNT SUPERVISOR FOR HOTEL';
  }
  
  // Office based employees (HEAD OFFICE and NON HOTEL)
  if (locUpper === 'HEAD OFFICE' || locUpper.includes('HEAD OFFICE') || 
      locUpper === 'NON HOTEL' || locUpper.includes('NON HOTEL')) {
    // Determine sub-group based on position
    // Check RECRUITMENT first (before MANAGER check)
    if (posUpper.includes('RECRUIT')) {
      return 'RECRUITMENT';
    } else if (posUpper.includes('ACCOUNTING')) {
      return 'ACCOUNTING';
    } else if (posUpper.includes('MANAGER') || posUpper.includes('HEAD') || posUpper.includes('DIRECTOR')) {
      return 'GP HEADS';
    } else {
      // Default for office based employees
      return 'HR & ADMIN';
    }
  }
  
  return null;
}

// Process rows - each row is an EMPLOYEE
// Column 1 = Employee ID
// Column 2 = Last Name
// Column 3 = First Name
// Column 4 = Position
// Column 5 = Location (HEAD OFFICE = office based, NON HOTEL/HOTEL = client based)
// Column 6 = OT Approver Email
// Columns 7-8 = OT Viewer Emails
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 6) continue;

  const employeeId = row[0];
  const lastName = row[1]?.toString().trim() || '';
  const firstName = row[2]?.toString().trim() || '';
  const position = row[3]?.toString().trim() || '';
  const location = row[4]?.toString().trim() || ''; // Column 5 = Location

  // Column 6 = OT Approver email for this employee
  const approverEmail = normalizeEmail(row[5]);
  
  // Columns 7-8 = OT Viewer emails for this employee
  const viewerEmail1 = normalizeEmail(row[6]);
  const viewerEmail2 = normalizeEmail(row[7]);

  // Determine OT group based on THIS EMPLOYEE's location/position
  // HEAD OFFICE = office based
  // NON HOTEL/HOTEL = client based
  const otGroupName = determineOTGroup(location, position);

  if (!otGroupName) {
    console.warn(`⚠️  Could not determine OT group for employee ${employeeId} (${firstName} ${lastName}) - Location: ${location}, Position: ${position}`);
    continue;
  }

  // Process approver email - count occurrences for each group
  if (approverEmail && approverEmail.includes('@')) {
    if (!userMap.has(approverEmail)) {
      userMap.set(approverEmail, {
        email: approverEmail,
        full_name: null, // Will be set from existing user or employees table
        roles: new Set(),
        approver_groups: new Set(),
        viewer_groups: new Set(),
      });
    }
    const approver = userMap.get(approverEmail);
    approver.roles.add('ot_approver');
    approver.approver_groups.add(otGroupName);
    
    // Count occurrences for this group
    if (!groupApproverCounts.has(otGroupName)) {
      groupApproverCounts.set(otGroupName, new Map());
    }
    const counts = groupApproverCounts.get(otGroupName);
    counts.set(approverEmail, (counts.get(approverEmail) || 0) + 1);
  }

  // Process viewer emails - count occurrences for each group
  [viewerEmail1, viewerEmail2].forEach(viewerEmail => {
    if (viewerEmail && viewerEmail.includes('@')) {
      if (!userMap.has(viewerEmail)) {
        userMap.set(viewerEmail, {
          email: viewerEmail,
          full_name: null,
          roles: new Set(),
          approver_groups: new Set(),
          viewer_groups: new Set(),
        });
      }
      const viewer = userMap.get(viewerEmail);
      viewer.roles.add('ot_viewer');
      viewer.viewer_groups.add(otGroupName);
      
      // Count occurrences for this group
      if (!groupViewerCounts.has(otGroupName)) {
        groupViewerCounts.set(otGroupName, new Map());
      }
      const counts = groupViewerCounts.get(otGroupName);
      counts.set(viewerEmail, (counts.get(viewerEmail) || 0) + 1);
    }
  });
}

console.log(`Found ${userMap.size} unique approvers/viewers to process\n`);

// Helper function to get or create user
async function getOrCreateUser(email, fullName) {
  // Check if user exists in users table
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("id, email, full_name, role")
    .eq("email", email)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
    throw new Error(`Error fetching user: ${fetchError.message}`);
  }

  if (existingUser) {
    // If user exists but doesn't have a full name, try to update it
    if (!existingUser.full_name && fullName) {
      await supabase
        .from("users")
        .update({ full_name: fullName })
        .eq("id", existingUser.id);
      existingUser.full_name = fullName;
    }
    return { user: existingUser, created: false };
  }
  
  // Also check if user exists in Auth but not in users table (orphaned auth user)
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
          role: 'ot_viewer', // Default role, will be updated
          is_active: true,
        })
        .select()
        .single();

      if (userInsertError) {
        throw new Error(`User table insert failed: ${userInsertError.message}`);
      }
      
      return { user: userData, created: false, wasOrphaned: true };
    }
  } catch (authError) {
    // If we can't check auth, continue with creating new user
    console.warn(`  ⚠️  Could not check Auth users: ${authError.message}`);
  }

  // User doesn't exist, create in Auth first
  // Generate password: first 8 chars of email prefix + "12345678"
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
      role: 'ot_viewer', // Default role, will be updated
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

  return { user: userData, created: true, password };
}

// Helper function to update user role
async function updateUserRole(userId, role) {
  const { error } = await supabase
    .from("users")
    .update({ role: role })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to update role: ${error.message}`);
  }
}

// Helper function to assign user to OT groups
async function assignUserToOTGroups(userId, userRole, groupNames, otGroups) {
  // Remove user from all groups of this role type first
  if (userRole === 'ot_approver') {
    await supabase
      .from("overtime_groups")
      .update({ approver_id: null })
      .eq("approver_id", userId);
  } else {
    await supabase
      .from("overtime_groups")
      .update({ viewer_id: null })
      .eq("viewer_id", userId);
  }

  // Assign to selected groups
  for (const groupName of groupNames) {
    const group = otGroups.find(g => g.name === groupName);
    if (!group) {
      console.warn(`  ⚠️  Group not found: ${groupName}`);
      continue;
    }

    const updateField = userRole === 'ot_approver' ? 'approver_id' : 'viewer_id';
    const updateData = {};
    updateData[updateField] = userId;
    
    const { error } = await supabase
      .from("overtime_groups")
      .update(updateData)
      .eq("id", group.id);

    if (error) {
      console.warn(`  ⚠️  Failed to assign to group ${groupName}: ${error.message}`);
    }
  }
}

async function importUsers() {
  if (dryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes will be made to the database\n");
  } else {
    console.log("\nStarting user import process...\n");
  }

  // Get OT groups
  console.log("Fetching OT groups...");
  const otGroups = await getOTGroups();
  console.log(`Found ${otGroups.length} OT groups\n`);

  // Fetch existing users
  console.log("Fetching existing users...");
  const { data: existingUsers, error: fetchError } = await supabase
    .from("users")
    .select("id, email, full_name, role");

  if (fetchError) {
    console.error("Error fetching existing users:", fetchError);
    process.exit(1);
  }

  const existingUsersMap = new Map(
    existingUsers.map(u => [u.email.toLowerCase(), u])
  );
  console.log(`Found ${existingUsers.length} existing users\n`);

  // Fetch employees to get better full names
  console.log("Fetching employees for name lookup...");
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
    
    // Update userMap with better names from employees table
    for (const [email, userData] of userMap.entries()) {
      const empName = employeeEmailMap.get(email.toLowerCase());
      if (empName && !userData.full_name) {
        userData.full_name = empName;
      }
    }
    console.log(`Found ${employees.length} employees for name lookup\n`);
  }

  let created = 0;
  let updated = 0;
  let errors = 0;
  const errorDetails = [];

  // First, determine the most common approver/viewer for each group
  // Since each group can only have one approver and one viewer, we'll pick the most frequent
  // Special case: GP HEADS should use mgrazal@greenpasture.ph if present
  const finalGroupAssignments = new Map();
  
  for (const [groupName, approverCounts] of groupApproverCounts.entries()) {
    let maxCount = 0;
    let mostCommonApprover = null;
    
    // Special handling for GP HEADS - prioritize mgrazal if present
    if (groupName === 'GP HEADS' && approverCounts.has('mgrazal@greenpasture.ph')) {
      mostCommonApprover = 'mgrazal@greenpasture.ph';
    } else {
      // For other groups, pick the most common
      for (const [email, count] of approverCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonApprover = email;
        }
      }
    }
    
    if (mostCommonApprover) {
      if (!finalGroupAssignments.has(groupName)) {
        finalGroupAssignments.set(groupName, { approver: null, viewer: null });
      }
      finalGroupAssignments.get(groupName).approver = mostCommonApprover;
    }
  }
  
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
      if (!finalGroupAssignments.has(groupName)) {
        finalGroupAssignments.set(groupName, { approver: null, viewer: null });
      }
      finalGroupAssignments.get(groupName).viewer = mostCommonViewer;
    }
  }
  
  // Update userMap to only include final assignments (most common approver/viewer per group)
  // First, clear all group assignments
  for (const [email, userData] of userMap.entries()) {
    userData.approver_groups.clear();
    userData.viewer_groups.clear();
  }
  
  // Then assign based on most common
  for (const [groupName, assignments] of finalGroupAssignments.entries()) {
    if (assignments.approver) {
      const user = userMap.get(assignments.approver);
      if (user) {
        user.approver_groups.add(groupName);
        user.roles.add('ot_approver'); // Ensure they have approver role
      }
    }
    if (assignments.viewer) {
      const user = userMap.get(assignments.viewer);
      if (user) {
        // Only add if they're not already the approver for this group
        if (!assignments.approver || assignments.viewer !== assignments.approver) {
          user.viewer_groups.add(groupName);
          user.roles.add('ot_viewer'); // Ensure they have viewer role
        }
      }
    }
  }
  
  console.log("\nFinal group assignments (most common approver/viewer per group):");
  for (const [groupName, assignments] of finalGroupAssignments.entries()) {
    console.log(`  ${groupName}:`);
    if (assignments.approver) {
      const user = userMap.get(assignments.approver);
      console.log(`    Approver: ${user?.full_name || assignments.approver} (${assignments.approver})`);
    }
    if (assignments.viewer) {
      const user = userMap.get(assignments.viewer);
      console.log(`    Viewer: ${user?.full_name || assignments.viewer} (${assignments.viewer})`);
    }
  }
  console.log();

  // Process each unique approver/viewer
  for (const [email, userData] of userMap.entries()) {
    try {
      const existingUser = existingUsersMap.get(email.toLowerCase());
      
      // Determine primary role (approver takes precedence)
      // If user is approver for any group, make them ot_approver
      // Otherwise, make them ot_viewer
      const primaryRole = userData.roles.has('ot_approver') ? 'ot_approver' : 'ot_viewer';
      
      if (existingUser) {
        // User exists - update role if needed
        if (existingUser.role !== primaryRole) {
          if (!dryRun) {
            await updateUserRole(existingUser.id, primaryRole);
          }
          updated++;
          console.log(
            `✓ ${dryRun ? "[DRY RUN] Would update" : "Updated"} role: ${existingUser.full_name || email} (${email}) -> ${primaryRole}`
          );
        } else {
          console.log(`⊘ Role unchanged: ${existingUser.full_name || email} (${email}) - Role: ${existingUser.role}`);
        }

        // Update OT group assignments
        // If user is approver, assign to approver groups
        // If user is viewer, assign to viewer groups (but not if they're already approver for that group)
        if (primaryRole === 'ot_approver') {
          const approverGroups = Array.from(userData.approver_groups);
          if (approverGroups.length > 0) {
            if (!dryRun) {
              await assignUserToOTGroups(existingUser.id, 'ot_approver', approverGroups, otGroups);
            }
            console.log(`  → Assigned as APPROVER to groups: ${approverGroups.join(', ')}`);
          }
          
          // Also assign to viewer groups if they're viewer for other groups
          const viewerGroups = Array.from(userData.viewer_groups).filter(
            g => !userData.approver_groups.has(g)
          );
          if (viewerGroups.length > 0) {
            if (!dryRun) {
              await assignUserToOTGroups(existingUser.id, 'ot_viewer', viewerGroups, otGroups);
            }
            console.log(`  → Assigned as VIEWER to groups: ${viewerGroups.join(', ')}`);
          }
        } else {
          // User is viewer only - assign to viewer groups
          const viewerGroups = Array.from(userData.viewer_groups);
          if (viewerGroups.length > 0) {
            if (!dryRun) {
              await assignUserToOTGroups(existingUser.id, 'ot_viewer', viewerGroups, otGroups);
            }
            console.log(`  → Assigned as VIEWER to groups: ${viewerGroups.join(', ')}`);
          }
        }
      } else {
        // User doesn't exist - create new user
        if (!dryRun) {
          const result = await getOrCreateUser(email, userData.full_name);
          const newUser = result.user;
          
          // Update role if not already set correctly
          if (newUser.role !== primaryRole) {
            await updateUserRole(newUser.id, primaryRole);
          }

          // Assign to OT groups
          if (primaryRole === 'ot_approver') {
            const approverGroups = Array.from(userData.approver_groups);
            if (approverGroups.length > 0) {
              await assignUserToOTGroups(newUser.id, 'ot_approver', approverGroups, otGroups);
              console.log(`  → Assigned as APPROVER to groups: ${approverGroups.join(', ')}`);
            }
            
            // Also assign to viewer groups if they're viewer for other groups
            const viewerGroups = Array.from(userData.viewer_groups).filter(
              g => !userData.approver_groups.has(g)
            );
            if (viewerGroups.length > 0) {
              await assignUserToOTGroups(newUser.id, 'ot_viewer', viewerGroups, otGroups);
              console.log(`  → Assigned as VIEWER to groups: ${viewerGroups.join(', ')}`);
            }
          } else {
            const viewerGroups = Array.from(userData.viewer_groups);
            if (viewerGroups.length > 0) {
              await assignUserToOTGroups(newUser.id, 'ot_viewer', viewerGroups, otGroups);
              console.log(`  → Assigned as VIEWER to groups: ${viewerGroups.join(', ')}`);
            }
          }

          created++;
          console.log(
            `+ Created: ${newUser.full_name || email} (${email}) - Role: ${primaryRole}`
          );
          if (result.password) {
            console.log(`  → Password: ${result.password}`);
          }
        } else {
          created++;
          console.log(
            `+ [DRY RUN] Would create: ${userData.full_name || email} (${email}) - Role: ${primaryRole}`
          );
          if (primaryRole === 'ot_approver') {
            const approverGroups = Array.from(userData.approver_groups);
            if (approverGroups.length > 0) {
              console.log(`  → Would assign as APPROVER to groups: ${approverGroups.join(', ')}`);
            }
            const viewerGroups = Array.from(userData.viewer_groups).filter(
              g => !userData.approver_groups.has(g)
            );
            if (viewerGroups.length > 0) {
              console.log(`  → Would assign as VIEWER to groups: ${viewerGroups.join(', ')}`);
            }
          } else {
            const viewerGroups = Array.from(userData.viewer_groups);
            if (viewerGroups.length > 0) {
              console.log(`  → Would assign as VIEWER to groups: ${viewerGroups.join(', ')}`);
            }
          }
        }
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
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total unique approvers/viewers found: ${userMap.size}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  
  if (errorDetails.length > 0) {
    console.log("\nErrors:");
    errorDetails.forEach(err => console.log(`  - ${err}`));
  }
  
  console.log("\n" + "=".repeat(80));
}

// Run import
importUsers()
  .then(() => {
    console.log("\n✅ Import completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  });
