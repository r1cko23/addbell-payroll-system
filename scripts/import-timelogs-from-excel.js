#!/usr/bin/env node
/**
 * Import Time Logs from Excel
 * 
 * This script imports time clock entries from an Excel file.
 * Expected format:
 * - Column 1: Employee Name (full name)
 * - Column 2: Date (Excel serial date)
 * - Column 3: Clock In (Excel time fraction)
 * - Column 4: Clock Out (Excel time fraction)
 * 
 * Usage:
 *   node scripts/import-timelogs-from-excel.js [path-to-excel-file] [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
const excelFile = excelFileArg || path.join(__dirname, "..", "Timelogs Jan 2 - 4, 2026.xlsx");

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  console.error("\nUsage: node scripts/import-timelogs-from-excel.js [path-to-excel-file] [--dry-run]");
  process.exit(1);
}

// Convert Excel serial date to JavaScript Date
// Note: Excel file has dates in day/month/year format (e.g., "2/1/26" = Jan 2, 2026)
// But Excel stored them as month/day/year (e.g., "2/1/26" = Feb 1, 2026)
// If Excel serial 46054 = Feb 1, 2026 but should be Jan 2, 2026, that's 30 days earlier
// So we subtract 30 days from the serial number to get the correct date
// This function handles both date-only serials and date+time combined serials
function excelDateToJSDate(serial) {
  // Use XLSX library's built-in date parsing
  const dateObj = XLSX.SSF.parse_date_code(serial);
  if (!dateObj) {
    // Fallback calculation
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    return new Date(excelEpoch.getTime() + serial * 86400000);
  }
  
  // Excel interpreted dates as month/day/year, but they should be day/month/year
  // For dates in January 2026, Excel stored them as February dates (30 days later)
  // So we need to subtract 30 days from the date part of the serial number
  // But only if the parsed date is in February 2026 (which should be January)
  if (dateObj.y === 2026 && dateObj.m === 2) {
    // This is February, but should be January - subtract 30 days from date part only
    // Preserve the time fraction (decimal part)
    const datePart = Math.floor(serial);
    const timePart = serial - datePart;
    const correctedDateSerial = datePart - 30 + timePart;
    
    const correctedDateObj = XLSX.SSF.parse_date_code(correctedDateSerial);
    if (correctedDateObj && correctedDateObj.y === 2026 && correctedDateObj.m === 1) {
      // Create date in local timezone (Excel times are already in local time)
      return new Date(
        correctedDateObj.y, 
        correctedDateObj.m - 1, 
        correctedDateObj.d, 
        correctedDateObj.H || 0, 
        correctedDateObj.M || 0, 
        correctedDateObj.S || 0
      );
    }
  }
  
  // Try swapping month and day for dates where day <= 12
  const excelMonth = dateObj.m;
  const excelDay = dateObj.d;
  
  if (excelDay >= 1 && excelDay <= 12 && excelMonth >= 1 && excelMonth <= 31) {
    // Swap: day becomes month, month becomes day
    const correctMonth = excelDay;
    const correctDay = excelMonth;
    
    if (correctMonth >= 1 && correctMonth <= 12 && correctDay >= 1 && correctDay <= 31) {
      return new Date(dateObj.y, correctMonth - 1, correctDay, dateObj.H || 0, dateObj.M || 0, dateObj.S || 0);
    }
  }
  
  // If no correction applies, use original
  return new Date(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H || 0, dateObj.M || 0, dateObj.S || 0);
}

// Convert Excel time fraction to hours and minutes
function excelTimeToTime(dateSerial, timeFraction) {
  if (timeFraction == null || timeFraction === '') return null;
  
  // Combine date and time serial numbers
  const combinedSerial = dateSerial + timeFraction;
  
  // Use the same date correction function which handles the date format issue
  const jsDate = excelDateToJSDate(combinedSerial);
  
  return {
    hours: jsDate.getHours(),
    minutes: jsDate.getMinutes(),
    seconds: jsDate.getSeconds(),
    date: jsDate
  };
}

// Normalize name for matching (remove extra spaces, convert to lowercase, handle commas)
function normalizeName(name) {
  if (!name) return '';
  return name.toString()
    .trim()
    .replace(/,/g, ' ') // Replace commas with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .toLowerCase();
}

// Find employee UUID by name
async function findEmployeeByName(name) {
  const normalized = normalizeName(name);
  const originalName = name.trim();
  
  // Get all active employees for fuzzy matching
  const { data: allEmployees, error: fetchError } = await supabase
    .from('employees')
    .select('id, employee_id, full_name, first_name, last_name')
    .eq('is_active', true);
  
  if (fetchError || !allEmployees) {
    return null;
  }
  
  // Extract name parts from Excel (handle formats like "Last, First" or "First Last")
  let excelLastName = '';
  let excelFirstName = '';
  const nameParts = normalized.split(' ').filter(p => p.length > 0);
  
  if (normalized.includes(',')) {
    // Format: "Last, First" or "Last, First Middle"
    const parts = normalized.split(',').map(p => p.trim());
    excelLastName = parts[0] || '';
    excelFirstName = parts.slice(1).join(' ').trim();
  } else if (nameParts.length >= 2) {
    // Format: "First Last" or "Last First" - try both orders
    excelFirstName = nameParts[0];
    excelLastName = nameParts[nameParts.length - 1];
  }
  
  // Try exact match first (case-insensitive)
  const lowerName = normalized;
  for (const emp of allEmployees) {
    const empFull = normalizeName(emp.full_name || '');
    if (empFull === lowerName) {
      return emp.id;
    }
  }
  
  // Try matching by last name (most reliable) and first name
  if (excelLastName && excelFirstName) {
    for (const emp of allEmployees) {
      const empLast = normalizeName(emp.last_name || '');
      const empFirst = normalizeName(emp.first_name || '');
      const empFull = normalizeName(emp.full_name || '');
      
      // Check if last name matches exactly and first name contains the excel first name (or vice versa)
      if (empLast === excelLastName) {
        // Last name matches, check first name
        if (empFirst.includes(excelFirstName) || excelFirstName.includes(empFirst) || 
            empFull.includes(excelFirstName)) {
          return emp.id;
        }
      }
      
      // Also try reverse order (Excel might have "First Last" format)
      if (empLast === excelFirstName && empFirst.includes(excelLastName)) {
        return emp.id;
      }
    }
  }
  
  // Try matching by last name only (if we have it)
  if (excelLastName) {
    for (const emp of allEmployees) {
      const empLast = normalizeName(emp.last_name || '');
      const empFull = normalizeName(emp.full_name || '');
      
      if (empLast === excelLastName && empFull.includes(excelFirstName)) {
        return emp.id;
      }
    }
  }
  
  // Try substring matching on full name
  for (const emp of allEmployees) {
    const empFull = normalizeName(emp.full_name || '');
    const empLast = normalizeName(emp.last_name || '');
    const empFirst = normalizeName(emp.first_name || '');
    
    // Check if all name parts from Excel appear in the employee's name
    let matchCount = 0;
    for (const part of nameParts) {
      if (part.length > 2) { // Only match parts longer than 2 characters
        if (empFull.includes(part) || empLast.includes(part) || empFirst.includes(part)) {
          matchCount++;
        }
      }
    }
    
    // If at least 2 parts match, consider it a match
    if (matchCount >= 2 && nameParts.length >= 2) {
      return emp.id;
    }
  }
  
  return null;
}

// Get office location for default location
async function getOfficeLocation() {
  const { data, error } = await supabase
    .from('office_locations')
    .select('latitude, longitude')
    .limit(1)
    .single();

  if (error || !data) {
    return { lat: 14.5995, lng: 120.9842 }; // Default: Manila, Philippines
  }

  return { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) };
}

// Main import function
async function importTimeLogs() {
  console.log("=".repeat(80));
  console.log("TIME LOGS IMPORT FROM EXCEL");
  console.log("=".repeat(80));
  console.log(`\nExcel file: ${excelFile}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE IMPORT"}\n`);

  // Read Excel file
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Read data - first row should be headers
  const data = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    header: 1,
  });

  // Check if first row looks like headers (contains text like "Name", "Date", etc.)
  let headerRowIndex = 0;
  const firstRow = data[0] || [];
  const hasHeaderKeywords = firstRow.some(cell => 
    cell && typeof cell === 'string' && 
    (cell.toLowerCase().includes('name') || 
     cell.toLowerCase().includes('date') || 
     cell.toLowerCase().includes('clock'))
  );

  if (!hasHeaderKeywords && data.length > 1) {
    // First row might be data, check second row
    const secondRow = data[1] || [];
    const secondRowHasHeaders = secondRow.some(cell => 
      cell && typeof cell === 'string' && 
      (cell.toLowerCase().includes('name') || 
       cell.toLowerCase().includes('date') || 
       cell.toLowerCase().includes('clock'))
    );
    if (secondRowHasHeaders) {
      headerRowIndex = 1;
    }
  }

  const headers = data[headerRowIndex] || [];
  const rows = data.slice(headerRowIndex + 1).filter(row => row && row.length > 0 && row[0] != null);

  console.log("Headers:", headers);
  console.log(`\nTotal rows: ${rows.length}\n`);

  // Get office location
  const officeLoc = await getOfficeLocation();
  const locationString = `${officeLoc.lat.toFixed(6)}, ${officeLoc.lng.toFixed(6)}`;

  // Process rows
  const entries = [];
  const errors = [];
  const employeeCache = {}; // Cache employee lookups

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0]?.toString().trim();
    const dateSerial = row[1];
    const clockInFraction = row[2];
    const clockOutFraction = row[3];

    if (!name) {
      continue;
    }

    // Skip rows without clock in or clock out
    if (clockInFraction == null && clockOutFraction == null) {
      continue;
    }

    // Convert dates
    let clockInTime = null;
    let clockOutTime = null;

    if (clockInFraction != null && clockInFraction !== '') {
      const timeData = excelTimeToTime(dateSerial, clockInFraction);
      if (timeData) {
        clockInTime = timeData.date;
      }
    }

    if (clockOutFraction != null && clockOutFraction !== '') {
      const timeData = excelTimeToTime(dateSerial, clockOutFraction);
      if (timeData) {
        clockOutTime = timeData.date;
      }
    }

    // Validate times - clock_in_time is required
    if (!clockInTime) {
      errors.push({
        row: i + 2,
        name,
        error: "Clock in time is required"
      });
      continue;
    }

    if (clockOutTime && clockOutTime <= clockInTime) {
      errors.push({
        row: i + 2,
        name,
        error: "Clock out time must be after clock in time"
      });
      continue;
    }

    // Find employee
    let employeeId = employeeCache[name];
    if (!employeeId) {
      employeeId = await findEmployeeByName(name);
      if (employeeId) {
        employeeCache[name] = employeeId;
      }
    }

    if (!employeeId) {
      errors.push({
        row: i + 2,
        name,
        error: "Employee not found in database"
      });
      continue;
    }

    // Create entry - clock_in_time is always present at this point
    const entry = {
      employee_id: employeeId,
      clock_in_time: clockInTime.toISOString(),
      clock_out_time: clockOutTime ? clockOutTime.toISOString() : null,
      clock_in_location: locationString,
      clock_out_location: clockOutTime ? locationString : null,
      clock_in_device: 'Manual Import',
      clock_out_device: clockOutTime ? 'Manual Import' : null,
      is_manual_entry: true,
      status: clockOutTime ? 'clocked_out' : 'clocked_in',
      employee_notes: `Imported from Excel - ${path.basename(excelFile)}`
    };

    entries.push({
      ...entry,
      name,
      row: i + 2
    });
  }

  console.log(`\n✅ Processed ${entries.length} valid entries`);
  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} errors encountered:\n`);
    errors.forEach(err => {
      console.log(`  Row ${err.row}: ${err.name} - ${err.error}`);
    });
  }

  if (entries.length === 0) {
    console.log("\n❌ No valid entries to import.");
    return;
  }

  // Show preview
  console.log("\n📋 Preview of entries to import:\n");
  entries.slice(0, 5).forEach(entry => {
    const clockIn = entry.clock_in_time 
      ? new Date(entry.clock_in_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' })
      : 'N/A';
    const clockOut = entry.clock_out_time 
      ? new Date(entry.clock_out_time).toLocaleString('en-US', { timeZone: 'Asia/Manila' })
      : 'N/A';
    console.log(`  ${entry.name}: ${clockIn} → ${clockOut}`);
  });
  if (entries.length > 5) {
    console.log(`  ... and ${entries.length - 5} more entries`);
  }

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes made.");
    return;
  }

  // Check for existing entries and filter them out
  console.log("\n🔍 Checking for existing entries...\n");
  
  const entriesToInsert = [];
  const entriesToSkip = [];
  
  for (const entry of entries) {
    // Check if entry already exists for this employee on this date
    // Use a wider time range to account for timezone differences
    const clockInDate = new Date(entry.clock_in_time);
    const startOfDay = new Date(clockInDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    startOfDay.setUTCHours(startOfDay.getUTCHours() - 8); // Philippines is UTC+8, so subtract 8 hours
    
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCHours(23, 59, 59, 999);
    endOfDay.setUTCHours(endOfDay.getUTCHours() + 8); // Add 8 hours back
    
    // Query for existing entries on this date for this employee
    // Use a wider range to catch entries in Philippines timezone
    const { data: existing, error: checkError } = await supabase
      .from('time_clock_entries')
      .select('id, is_manual_entry, clock_in_time')
      .eq('employee_id', entry.employee_id)
      .gte('clock_in_time', startOfDay.toISOString())
      .lte('clock_in_time', endOfDay.toISOString())
      .limit(5);
    
    if (checkError) {
      console.error(`⚠️  Error checking existing entry for ${entry.name}:`, checkError.message);
      entriesToInsert.push(entry); // Try to insert anyway
      continue;
    }
    
    if (existing && existing.length > 0) {
      // Entry exists - if it's manual, we can update it; otherwise skip
      if (existing[0].is_manual_entry) {
        // Update existing manual entry
        const { error: updateError } = await supabase
          .from('time_clock_entries')
          .update({
            clock_in_time: entry.clock_in_time,
            clock_out_time: entry.clock_out_time,
            clock_in_location: entry.clock_in_location,
            clock_out_location: entry.clock_out_location,
            clock_out_device: entry.clock_out_device,
            status: entry.status,
            employee_notes: entry.employee_notes
          })
          .eq('id', existing[0].id);
        
        if (updateError) {
          console.error(`⚠️  Error updating entry for ${entry.name}:`, updateError.message);
          entriesToSkip.push({ ...entry, reason: 'Update failed' });
        } else {
          entriesToSkip.push({ ...entry, reason: 'Updated existing entry' });
        }
      } else {
        entriesToSkip.push({ ...entry, reason: 'Entry already exists (not manual)' });
      }
    } else {
      entriesToInsert.push(entry);
    }
  }
  
  console.log(`✅ ${entriesToInsert.length} entries to insert`);
  console.log(`⏭️  ${entriesToSkip.length} entries skipped (already exist)`);
  
  if (entriesToInsert.length === 0) {
    console.log("\n✅ All entries already exist in database.\n");
    return;
  }

  // Import entries
  console.log("\n📥 Importing entries...\n");

  let successCount = 0;
  let failCount = 0;

  // Insert in batches of 50
  for (let i = 0; i < entriesToInsert.length; i += 50) {
    const batch = entriesToInsert.slice(i, i + 50);
    const insertData = batch.map(e => ({
      employee_id: e.employee_id,
      clock_in_time: e.clock_in_time,
      clock_out_time: e.clock_out_time,
      clock_in_location: e.clock_in_location,
      clock_out_location: e.clock_out_location,
      clock_in_device: e.clock_in_device,
      clock_out_device: e.clock_out_device,
      is_manual_entry: e.is_manual_entry,
      status: e.status,
      employee_notes: e.employee_notes
    }));

    const { data, error } = await supabase
      .from('time_clock_entries')
      .insert(insertData)
      .select('id');

    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / 50) + 1}:`, error.message);
      failCount += batch.length;
    } else {
      successCount += data.length;
      console.log(`✅ Inserted batch ${Math.floor(i / 50) + 1}: ${data.length} entries`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Successfully imported: ${successCount} entries`);
  console.log(`❌ Failed: ${failCount} entries`);
  if (errors.length > 0) {
    console.log(`⚠️  Skipped due to errors: ${errors.length} entries`);
  }
  console.log("=".repeat(80) + "\n");
}

// Run import
importTimeLogs().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
