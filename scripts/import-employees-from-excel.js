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

const excelFile = path.join(
  __dirname,
  "..",
  "data",
  "UPDATED MASTERLIST ORGANIC.xlsx"
);

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  process.exit(1);
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
const rows = data.slice(1);

// Convert to objects with proper headers
const excelEmployees = rows
  .map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] !== undefined ? row[idx] : null;
    });
    return obj;
  })
  .filter((emp) => emp["EMPLOYEE ID"] != null); // Filter out empty rows

console.log("=".repeat(80));
console.log("EMPLOYEE IMPORT/UPDATE FROM EXCEL");
console.log("=".repeat(80));
console.log(`\nTotal employees in Excel: ${excelEmployees.length}`);

// Helper function to normalize employee data
function normalizeEmployeeData(excelRow) {
  const employeeId = String(excelRow["EMPLOYEE ID"]).trim();
  const lastName = excelRow["LAST NAME"]?.trim() || "";
  const firstName = excelRow["FIRST NAME"]?.trim() || "";
  const middleName = excelRow["MIDDLE NAME"]?.trim() || "";

  // Build full name
  const middleInitial = middleName
    ? ` ${middleName.charAt(0).toUpperCase()}.`
    : "";
  const fullName = `${firstName}${middleInitial} ${lastName}`.trim();

  // Parse dates - Excel dates might be numbers or strings
  let birthDate = excelRow["BIRTH DATE"] || null;
  let hireDate = excelRow["DATE HIRED"] || null;

  // Convert Excel date numbers to ISO format if needed
  if (birthDate && typeof birthDate === "number") {
    // Excel date serial number (days since Jan 1, 1900)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + birthDate * 86400000);
    birthDate = date.toISOString().split("T")[0];
  } else if (birthDate && typeof birthDate === "string") {
    // Ensure it's in YYYY-MM-DD format
    birthDate = birthDate.trim();
  }

  if (hireDate && typeof hireDate === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + hireDate * 86400000);
    hireDate = date.toISOString().split("T")[0];
  } else if (hireDate && typeof hireDate === "string") {
    hireDate = hireDate.trim();
  }

  // Parse rates
  const monthlyRate = excelRow["MONTHLY RATE"]
    ? parseFloat(excelRow["MONTHLY RATE"])
    : null;
  const perDay = excelRow["PER DAY"] ? parseFloat(excelRow["PER DAY"]) : null;

  // Parse OT eligibility
  const eligibleForOT =
    excelRow["ENTITLEMENT FOR OT"]?.toString().toUpperCase() === "YES";

  // Parse status
  const isActive =
    excelRow["STATUS"]?.toString().toUpperCase() === "REGULAR" ||
    excelRow["STATUS"]?.toString().toUpperCase() === "ACTIVE";

  return {
    employee_id: employeeId,
    full_name: fullName,
    last_name: lastName || null,
    first_name: firstName || null,
    middle_initial: middleName ? middleName.charAt(0).toUpperCase() : null,
    address: excelRow["ADDRESS"]?.trim() || null,
    birth_date: birthDate || null,
    hire_date: hireDate || null,
    tin_number: excelRow["TIN"]?.toString().trim() || null,
    sss_number: excelRow["SSS"]?.toString().trim() || null,
    philhealth_number: excelRow["PHILHEALTH"]?.toString().trim() || null,
    pagibig_number: excelRow["PAGIBIG"]?.toString().trim() || null,
    position: excelRow["POSITION"]?.trim() || null,
    job_level: excelRow["JOB LEVEL"]?.trim() || null,
    monthly_rate: monthlyRate,
    per_day: perDay,
    eligible_for_ot: eligibleForOT,
    is_active: isActive,
  };
}

async function importEmployees(dryRun = false) {
  if (dryRun) {
    console.log(
      "\n⚠️  DRY RUN MODE - No changes will be made to the database\n"
    );
  } else {
    console.log("\nStarting import/update process...\n");
  }

  let created = 0;
  let updated = 0;
  let errors = 0;
  const errorDetails = [];

  // Fetch existing employees
  console.log("Fetching existing employees from database...");
  const { data: existingEmployees, error: fetchError } = await supabase
    .from("employees")
    .select("id, employee_id");

  if (fetchError) {
    console.error("Error fetching existing employees:", fetchError);
    process.exit(1);
  }

  const existingMap = new Map();
  existingEmployees.forEach((emp) => {
    existingMap.set(emp.employee_id, emp.id);
  });

  console.log(
    `Found ${existingEmployees.length} existing employees in database\n`
  );

  // Process each employee from Excel
  for (let i = 0; i < excelEmployees.length; i++) {
    const excelRow = excelEmployees[i];
    const normalizedData = normalizeEmployeeData(excelRow);

    try {
      const existingId = existingMap.get(normalizedData.employee_id);

      if (existingId) {
        // Update existing employee
        // Exclude portal_password to preserve existing password
        const { portal_password, ...updateData } = normalizedData;

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("employees")
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingId);

          if (updateError) {
            throw updateError;
          }
        }

        updated++;
        console.log(
          `✓ ${dryRun ? "[DRY RUN] Would update" : "Updated"}: ${
            normalizedData.full_name
          } (${normalizedData.employee_id}) - Password preserved`
        );
      } else {
        // Create new employee
        if (!dryRun) {
          // Get admin user ID for created_by
          const { data: adminUser } = await supabase
            .from("users")
            .select("id")
            .eq("role", "admin")
            .limit(1)
            .single();

          const { error: insertError } = await supabase
            .from("employees")
            .insert({
              ...normalizedData,
              portal_password: normalizedData.employee_id, // Default password
              created_by: adminUser?.id || null,
            });

          if (insertError) {
            throw insertError;
          }
        }

        created++;
        console.log(
          `+ ${dryRun ? "[DRY RUN] Would create" : "Created"}: ${
            normalizedData.full_name
          } (${normalizedData.employee_id})`
        );
      }
    } catch (error) {
      errors++;
      const errorMsg = `Error processing ${normalizedData.employee_id} (${normalizedData.full_name}): ${error.message}`;
      errorDetails.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total processed: ${excelEmployees.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
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
importEmployees(dryRun)
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