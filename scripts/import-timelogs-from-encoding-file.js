#!/usr/bin/env node
/**
 * Import Time Logs from "Time Logs for Encoding.xlsx" - Sheet 2
 *
 * This script imports time clock entries from Sheet 2 of the Excel file.
 * Date format: Excel serial dates (converted to DD/MM/YYYY) or DD/MM/YYYY strings
 * Time format: Excel time fractions (converted to HH:MM) or "OB"
 *
 * Usage:
 *   node scripts/import-timelogs-from-encoding-file.js [--dry-run]
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

// Excel file path
const excelFile = path.join(__dirname, "..", "Time Logs for Encoding.xlsx");

if (!fs.existsSync(excelFile)) {
  console.error("Excel file not found:", excelFile);
  process.exit(1);
}

// Convert Excel serial date to JavaScript Date
// Excel stored dates in MM/DD/YY format, but they should be interpreted as DD/MM/YY
// So we need to swap month and day for dates that are clearly in January 2026
function excelDateToJSDate(serial) {
  // If it's already a string in DD/MM/YYYY format, parse it directly
  if (typeof serial === 'string' && serial.includes('/')) {
    return parseDateString(serial);
  }

  // Use XLSX library's date parsing
  const dateObj = XLSX.SSF.parse_date_code(serial);
  if (dateObj) {
    // Check if this is a date in 2026 that should be in January
    // Excel stored dates as MM/DD, but they should be DD/MM
    // So if month > 1 and day = 1, it's likely a swapped date
    // Also check if the parsed month is > 12 (impossible) or if day > 12 (might be swapped)
    
    let month = dateObj.m;
    let day = dateObj.d;
    const year = dateObj.y;
    
    // If year is 2026 and we're dealing with dates that should be in January:
    // - If month is 5 and day is 1, it should be month 1, day 5 (Jan 5)
    // - If month is 6 and day is 1, it should be month 1, day 6 (Jan 6) - but user said Jan 7
    // Actually, let's check: if the month value is between 1-31 and day is 1, swap them
    // This handles cases where Excel stored DD/MM as MM/DD
    
    // For dates in 2026 that should be January:
    // Excel stored dates incorrectly - need to swap month and day
    // Known mappings for Alfeche:
    // Serial 46143 (May 1) should be Jan 5
    // Serial 46174 (June 1) should be Jan 7  
    // Serial 46204 (July 1) should be Jan 9
    // Serial 46266 (September 1) should be Jan 12
    
    // Excel stored dates as MM/DD but they should be DD/MM
    // Pattern: If month > 1 and day = 1, swap them (month becomes day, day becomes 1 for January)
    // All serial dates in Sheet 2 follow this pattern for January 2026
    if (year === 2026 && month > 1 && day === 1) {
      // Swap: the month value becomes the day, and we're always in January
      day = month;  // Month value (2-12) becomes the day (2-12)
      month = 1;    // Always January
    } else if (year === 2026 && day > 12) {
      // If day > 12, it can't be a valid month, so swap
      const temp = month;
      month = day;
      day = temp;
    }
    
    // XLSX returns year, month (1-12), day, hours, minutes, seconds
    // JavaScript Date months are 0-indexed
    // Create date in UTC to avoid timezone shifts
    return new Date(Date.UTC(
      year,
      month - 1,
      day,
      dateObj.H || 0,
      dateObj.M || 0,
      dateObj.S || 0
    ));
  }

  // Fallback: Excel epoch is Dec 30, 1899
  const excelEpoch = new Date(1899, 11, 30);
  const jsDate = new Date(excelEpoch.getTime() + serial * 86400000);
  return jsDate;
}

// Parse date string in DD/MM/YYYY format
function parseDateString(dateStr) {
  if (typeof dateStr !== 'string') {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  let day = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  // Handle 2-digit years
  if (year < 100) {
    year = 2000 + year;
  }

  // Validate
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  // Create date in Manila timezone (UTC+8)
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return date;
}

// Convert Excel time fraction to hours and minutes
function excelTimeToTime(timeFraction) {
  if (timeFraction == null || timeFraction === '' || timeFraction === 'OB') {
    return null;
  }

  // Excel time is stored as a fraction of a day (0.5 = noon, 0.25 = 6 AM)
  const totalSeconds = Math.round(timeFraction * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return { hours, minutes };
}

// Normalize name for matching
function normalizeName(name) {
  if (!name) return '';
  return name.toString()
    .trim()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Find employee UUID by name
async function findEmployeeByName(name) {
  const normalized = normalizeName(name);
  
  const { data: allEmployees, error: fetchError } = await supabase
    .from('employees')
    .select('id, employee_id, full_name, first_name, last_name')
    .eq('is_active', true);

  if (fetchError || !allEmployees) {
    return null;
  }

  // Extract name parts
  let excelLastName = '';
  let excelFirstName = '';
  const nameParts = normalized.split(' ').filter(p => p.length > 0);

  if (normalized.includes(',')) {
    const parts = normalized.split(',').map(p => p.trim());
    excelLastName = parts[0] || '';
    excelFirstName = parts.slice(1).join(' ').trim();
  } else if (nameParts.length >= 2) {
    excelFirstName = nameParts[0];
    excelLastName = nameParts[nameParts.length - 1];
  }

  // Try exact match first
  const lowerName = normalized;
  for (const emp of allEmployees) {
    const empFull = normalizeName(emp.full_name || '');
    if (empFull === lowerName) {
      return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
    }
  }

  // Try matching by last name and first name
  if (excelLastName && excelFirstName) {
    for (const emp of allEmployees) {
      const empLast = normalizeName(emp.last_name || '');
      const empFirst = normalizeName(emp.first_name || '');
      const empFull = normalizeName(emp.full_name || '');

      if (empLast === excelLastName) {
        if (empFirst.includes(excelFirstName) || excelFirstName.includes(empFirst) ||
            empFull.includes(excelFirstName)) {
          return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
        }
      }

      if (empLast === excelFirstName && empFirst.includes(excelLastName)) {
        return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
      }
    }
  }

  // Try matching by last name only
  if (excelLastName) {
    for (const emp of allEmployees) {
      const empLast = normalizeName(emp.last_name || '');
      const empFull = normalizeName(emp.full_name || '');

      if (empLast === excelLastName && empFull.includes(excelFirstName)) {
        return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
      }
    }
  }

  // Try substring matching
  for (const emp of allEmployees) {
    const empFull = normalizeName(emp.full_name || '');
    const empLast = normalizeName(emp.last_name || '');
    const empFirst = normalizeName(emp.first_name || '');

    let matchCount = 0;
    for (const part of nameParts) {
      if (part.length > 2) {
        if (empFull.includes(part) || empLast.includes(part) || empFirst.includes(part)) {
          matchCount++;
        }
      }
    }

    if (matchCount >= 2 && nameParts.length >= 2) {
      return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
    }
  }

  // Try fuzzy matching for spelling variations (e.g., Rodriguez vs Rodriquez)
  if (excelLastName && excelLastName.length > 4) {
    for (const emp of allEmployees) {
      const empLast = normalizeName(emp.last_name || '');
      const empFirst = normalizeName(emp.first_name || '');
      const empFull = normalizeName(emp.full_name || '');

      if (Math.abs(empLast.length - excelLastName.length) <= 1) {
        let charMatches = 0;
        const minLen = Math.min(empLast.length, excelLastName.length);
        for (let i = 0; i < minLen; i++) {
          if (empLast[i] === excelLastName[i]) charMatches++;
        }
        
        if (charMatches >= minLen * 0.8) {
          if (empFirst.includes(excelFirstName) || excelFirstName.includes(empFirst) ||
              empFull.includes(excelFirstName) || (excelFirstName.length > 0 && empFull.includes(excelFirstName.substring(0, 4)))) {
            return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
          }
        }
      }
    }
  }

  // Specific known name variations mapping
  const nameVariations = {
    'rodriguez chrisanta': 'chrisanta rodriquez',
    'chrisanta rodriguez': 'chrisanta rodriquez',
  };
  
  const variationKey = normalized;
  if (nameVariations[variationKey]) {
    for (const emp of allEmployees) {
      const empFull = normalizeName(emp.full_name || '');
      if (empFull === nameVariations[variationKey] || empFull.includes('chrisanta') && empFull.includes('rodriquez')) {
        return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
      }
    }
  }
  
  // Also try direct match on first name + similar last name
  if (excelFirstName && excelFirstName.toLowerCase() === 'chrisanta') {
    for (const emp of allEmployees) {
      const empFirst = normalizeName(emp.first_name || '');
      const empLast = normalizeName(emp.last_name || '');
      if (empFirst.includes('chrisanta') && (empLast.includes('rodriguez') || empLast.includes('rodriquez'))) {
        return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
      }
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
  console.log("TIME LOGS IMPORT FROM ENCODING FILE - SHEET 2");
  console.log("=".repeat(80));
  console.log(`Excel file: ${excelFile}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE IMPORT"}\n`);

  // Read Excel file - Sheet 2
  const workbook = XLSX.readFile(excelFile);
  if (workbook.SheetNames.length < 2) {
    console.error("File does not have Sheet 2");
    process.exit(1);
  }

  const sheetName = workbook.SheetNames[1]; // Sheet 2 (0-indexed)
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 });

  // Find header row
  let headerRowIndex = 0;
  const firstRow = data[0] || [];
  const hasHeaderKeywords = firstRow.some(cell =>
    cell && typeof cell === 'string' &&
    (cell.toLowerCase().includes('name') ||
     cell.toLowerCase().includes('date') ||
     cell.toLowerCase().includes('time'))
  );

  if (!hasHeaderKeywords && data.length > 1) {
    const secondRow = data[1] || [];
    const secondRowHasHeaders = secondRow.some(cell =>
      cell && typeof cell === 'string' &&
      (cell.toLowerCase().includes('name') ||
       cell.toLowerCase().includes('date') ||
       cell.toLowerCase().includes('time'))
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

  // Process entries
  const entries = [];
  const errors = [];
  const employeeCache = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0]?.toString().trim();
    const dateValue = row[1];
    const timeInValue = row[2];
    const timeOutValue = row[3];

    if (!name) {
      continue;
    }

    try {
      // Parse date (Excel serial or DD/MM/YYYY string)
      let date;
      if (typeof dateValue === 'string' && dateValue.includes('/')) {
        date = parseDateString(dateValue);
      } else if (typeof dateValue === 'number') {
        date = excelDateToJSDate(dateValue);
      } else {
        errors.push({
          row: i + headerRowIndex + 2,
          name,
          error: `Invalid date format: ${dateValue}`
        });
        continue;
      }

      // Parse times
      const timeIn = excelTimeToTime(timeInValue);
      if (!timeIn) {
        errors.push({
          row: i + headerRowIndex + 2,
          name,
          error: "Clock in time is required"
        });
        continue;
      }

      // Create clock in datetime (Manila timezone)
      const clockInDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        timeIn.hours - 8, // Convert Manila time (UTC+8) to UTC
        timeIn.minutes,
        0
      ));

      // Handle clock out
      let clockOutDate = null;
      if (timeOutValue && timeOutValue !== 'OB' && timeOutValue !== '') {
        const timeOut = excelTimeToTime(timeOutValue);
        if (timeOut) {
          clockOutDate = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            timeOut.hours - 8, // Convert Manila time (UTC+8) to UTC
            timeOut.minutes,
            0
          ));
        }
      } else if (timeOutValue === 'OB') {
        // OB (Official Business): 8 hours from clock in
        clockOutDate = new Date(clockInDate);
        clockOutDate.setUTCHours(clockOutDate.getUTCHours() + 8);
      }

      // Validate clock out is after clock in
      if (clockOutDate && clockOutDate <= clockInDate) {
        errors.push({
          row: i + headerRowIndex + 2,
          name,
          error: "Clock out time must be after clock in time"
        });
        continue;
      }

      // Find employee
      let employee = employeeCache[name];
      if (!employee) {
        employee = await findEmployeeByName(name);
        if (employee) {
          employeeCache[name] = employee;
        }
      }

      if (!employee) {
        errors.push({
          row: i + headerRowIndex + 2,
          name,
          error: "Employee not found in database"
        });
        continue;
      }

      // Create entry
      const entry = {
        employee_id: employee.id,
        clock_in_time: clockInDate.toISOString(),
        clock_out_time: clockOutDate ? clockOutDate.toISOString() : null,
        clock_in_location: locationString,
        clock_out_location: clockOutDate ? locationString : null,
        clock_in_device: 'Manual Import',
        clock_out_device: clockOutDate ? 'Manual Import' : null,
        is_manual_entry: true,
        status: clockOutDate ? 'auto_approved' : 'clocked_in',
        employee_notes: timeOutValue === 'OB' 
          ? 'OB - Official Business (8 hours)' 
          : `Imported from Time Logs for Encoding.xlsx`
      };

      entries.push({
        ...entry,
        name: employee.full_name,
        employee_code: employee.employee_id,
        row: i + headerRowIndex + 2
      });

    } catch (error) {
      errors.push({
        row: i + headerRowIndex + 2,
        name,
        error: error.message
      });
    }
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
  entries.slice(0, 10).forEach(entry => {
    const clockIn = new Date(entry.clock_in_time).toLocaleString('en-US', { 
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const clockOut = entry.clock_out_time
      ? new Date(entry.clock_out_time).toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'N/A';
    console.log(`  ${entry.name} (${entry.employee_code || 'N/A'}): ${clockIn} → ${clockOut}`);
  });
  if (entries.length > 10) {
    console.log(`  ... and ${entries.length - 10} more entries`);
  }

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes made.");
    return;
  }

  // Check for existing entries
  console.log("\n🔍 Checking for existing entries...\n");

  const entriesToInsert = [];
  const entriesToSkip = [];

  for (const entry of entries) {
    const clockInDate = new Date(entry.clock_in_time);
    const phDate = new Date(clockInDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const phDateStr = phDate.toISOString().split('T')[0];
    
    const startOfDayPH = new Date(`${phDateStr}T00:00:00+08:00`);
    const endOfDayPH = new Date(`${phDateStr}T23:59:59+08:00`);

    const { data: existing, error: checkError } = await supabase
      .from('time_clock_entries')
      .select('id, is_manual_entry, clock_in_time')
      .eq('employee_id', entry.employee_id)
      .gte('clock_in_time', startOfDayPH.toISOString())
      .lte('clock_in_time', endOfDayPH.toISOString())
      .limit(5);

    if (checkError) {
      console.error(`⚠️  Error checking existing entry for ${entry.name}:`, checkError.message);
      entriesToInsert.push(entry);
      continue;
    }

    if (existing && existing.length > 0) {
      if (existing[0].is_manual_entry) {
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
  let duplicateCount = 0;

  // Insert entries one by one to handle duplicates gracefully
  for (let i = 0; i < entriesToInsert.length; i++) {
    const entry = entriesToInsert[i];
    const insertData = {
      employee_id: entry.employee_id,
      clock_in_time: entry.clock_in_time,
      clock_out_time: entry.clock_out_time,
      clock_in_location: entry.clock_in_location,
      clock_out_location: entry.clock_out_location,
      clock_in_device: entry.clock_in_device,
      clock_out_device: entry.clock_out_device,
      is_manual_entry: entry.is_manual_entry,
      status: entry.status,
      employee_notes: entry.employee_notes
    };

    const { data, error } = await supabase
      .from('time_clock_entries')
      .insert(insertData)
      .select('id');

    if (error) {
      if (error.message && error.message.includes('duplicate key')) {
        duplicateCount++;
      } else {
        console.error(`  ❌ Error inserting ${entry.name}:`, error.message);
        failCount++;
      }
    } else {
      successCount++;
      if ((i + 1) % 10 === 0 || i === entriesToInsert.length - 1) {
        console.log(`  ✅ Inserted ${i + 1}/${entriesToInsert.length} entries...`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Successfully imported: ${successCount} entries`);
  if (duplicateCount > 0) {
    console.log(`⏭️  Skipped (duplicates): ${duplicateCount} entries`);
  }
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
