const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

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

const workbook = XLSX.readFile(excelFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Read with header row (skip first row which is title)
const data = XLSX.utils.sheet_to_json(worksheet, {
  defval: null,
  header: 1, // Get raw data first
  range: 1, // Start from row 1 (0-indexed, so row 2 in Excel)
});

// First row contains headers
const headers = data[0] || [];
const rows = data.slice(1);

// Convert to objects with proper headers
const dataObjects = rows.map((row) => {
  const obj = {};
  headers.forEach((header, idx) => {
    obj[header] = row[idx] !== undefined ? row[idx] : null;
  });
  return obj;
});

console.log("=".repeat(80));
console.log("EXCEL FILE ANALYSIS");
console.log("=".repeat(80));
console.log(`\nSheet Name: ${sheetName}`);
console.log(`Total Data Rows: ${dataObjects.length}`);

console.log("\n" + "=".repeat(80));
console.log("COLUMNS IN EXCEL FILE:");
console.log("=".repeat(80));
const columns = headers.filter((h) => h && h.trim() !== "");
columns.forEach((col, i) => {
  console.log(`${i + 1}. ${col}`);
});

console.log("\n" + "=".repeat(80));
console.log("FIRST 3 DATA ROWS:");
console.log("=".repeat(80));
console.log(JSON.stringify(dataObjects.slice(0, 3), null, 2));

// Check for duplicates
console.log("\n" + "=".repeat(80));
console.log("CHECKING FOR DUPLICATES:");
console.log("=".repeat(80));

// Try to find employee ID column
const empIdColumns = columns.filter(
  (col) =>
    col &&
    col.toLowerCase().includes("employee") &&
    col.toLowerCase().includes("id")
);

if (empIdColumns.length > 0) {
  const empIdCol = empIdColumns[0];
  const empIds = dataObjects
    .map((row) => row[empIdCol])
    .filter((id) => id != null);
  const duplicates = empIds.filter((id, index) => empIds.indexOf(id) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];

  if (uniqueDuplicates.length > 0) {
    console.log(`\nFound ${uniqueDuplicates.length} duplicate employee IDs:`);
    uniqueDuplicates.forEach((id) => {
      const count = empIds.filter((eid) => eid === id).length;
      console.log(`  - ${id}: appears ${count} times`);
    });

    console.log("\nDuplicate rows:");
    uniqueDuplicates.forEach((id) => {
      const rows = dataObjects.filter((row) => row[empIdCol] === id);
      console.log(`\n  Employee ID: ${id}`);
      rows.forEach((row, idx) => {
        console.log(`    Row ${idx + 1}:`, JSON.stringify(row, null, 2));
      });
    });
  } else {
    console.log("No duplicate employee IDs found ✓");
  }
} else {
  console.log(
    "Could not find employee ID column. Available columns:",
    columns.join(", ")
  );
}

// Database columns (from the schema)
const dbColumns = [
  "id",
  "employee_id",
  "full_name",
  "is_active",
  "created_at",
  "updated_at",
  "created_by",
  "last_name",
  "first_name",
  "middle_initial",
  "portal_password",
  "assigned_hotel",
  "address",
  "birth_date",
  "tin_number",
  "sss_number",
  "philhealth_number",
  "pagibig_number",
  "hmo_provider",
  "sil_credits",
  "maternity_credits",
  "paternity_credits",
  "hire_date",
  "sil_balance_year",
  "sil_last_accrual",
  "gender",
  "profile_picture_url",
  "position",
  "eligible_for_ot",
];

console.log("\n" + "=".repeat(80));
console.log("COMPARING EXCEL COLUMNS WITH DATABASE SCHEMA:");
console.log("=".repeat(80));

// Normalize column names for comparison
const normalizeCol = (col) => {
  if (!col) return "";
  return col
    .toLowerCase()
    .replace(/[_\s-]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

// Map Excel columns to database columns
const columnMapping = {
  "EMPLOYEE ID": "employee_id",
  "LAST NAME": "last_name",
  "FIRST NAME": "first_name",
  "MIDDLE NAME": "middle_initial",
  ADDRESS: "address",
  "MONTHLY RATE": null, // Not in DB, but we might need it
  "PER DAY": null, // Not in DB, but we might need it
  POSITION: "position",
  "JOB LEVEL": null, // NEW COLUMN TO ADD
  "ENTITLEMENT FOR OT": "eligible_for_ot",
  "BIRTH DATE": "birth_date",
  "DATE HIRED": "hire_date",
  TIN: "tin_number",
  SSS: "sss_number",
  PHILHEALTH: "philhealth_number",
  PAGIBIG: "pagibig_number",
  STATUS: "is_active",
};

const excelColsNormalized = columns
  .filter((col) => col && col.trim() !== "")
  .map((col) => ({
    original: col,
    normalized: normalizeCol(col),
    mapped: columnMapping[col] || null,
  }));

const dbColsNormalized = dbColumns.map((col) => ({
  original: col,
  normalized: normalizeCol(col),
}));

const missingInDb = excelColsNormalized.filter(
  (excelCol) =>
    !excelCol.mapped &&
    !dbColsNormalized.some((dbCol) => dbCol.normalized === excelCol.normalized)
);

const missingInExcel = dbColsNormalized.filter(
  (dbCol) =>
    !excelColsNormalized.some(
      (excelCol) =>
        excelCol.normalized === dbCol.normalized ||
        excelCol.mapped === dbCol.original
    )
);

if (missingInDb.length > 0) {
  console.log("\n⚠️  COLUMNS IN EXCEL BUT NOT IN DATABASE:");
  missingInDb.forEach((col) => {
    console.log(`  - ${col.original}`);
  });
} else {
  console.log("\n✓ All Excel columns exist in database");
}

if (missingInExcel.length > 0) {
  console.log("\n📋 COLUMNS IN DATABASE BUT NOT IN EXCEL:");
  missingInExcel.forEach((col) => {
    console.log(`  - ${col.original}`);
  });
}

console.log("\n" + "=".repeat(80));