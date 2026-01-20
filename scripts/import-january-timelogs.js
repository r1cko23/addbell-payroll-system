#!/usr/bin/env node
/**
 * Import January Time Logs
 *
 * This script imports time clock entries for January 2026 from the provided data.
 * Date format: DD/MM/YYYY
 * Time format: HH:MM (24-hour)
 * OB entries: Official Business (8 hours from clock in)
 *
 * Usage:
 *   node scripts/import-january-timelogs.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
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

// Time log data from the image
// Format: [Name, Date (DD/MM/YYYY), Time In (HH:MM), Time Out (HH:MM or "OB")]
// Note: "Rodriguez, Chrisanta" should match "CHRISANTA RODRIQUEZ" in database (spelling variation)
const timeLogData = [
  ["Alberto, Jonathan", "5/1/26", "7:17", "17:02"],
  ["Alfeche Andres", "5/1/26", "9:00", "18:00"], // Added Jan 5 entry - update time if needed
  ["Alfeche Andres", "13/01/2026", "10:00", "OB"],
  ["Baluyot, Marta", "2/1/26", "9:15", "18:25"],
  ["Corpuz, Mary Nicole", "5/1/26", "8:30", "17:00"],
  ["De Leon, Jenalie", "5/1/26", "6:48", "OB"],
  ["Felizardo, Jomar", "7/1/26", "8:00", "17:30"],
  ["Gammad April", "2/1/26", "8:15", "17:15"],
  ["Gatmaitan, Jennelyn", "5/1/26", "7:30", "17:45"],
  ["Hernani Angeline", "13/01/2026", "9:00", "18:00"],
  ["Lorenzana, Rowena", "14/01/2026", "8:00", "17:00"],
  ["Macabenta, Regine", "2/1/26", "7:45", "16:45"],
  ["Magbag, Lea", "5/1/26", "8:00", "17:00"],
  ["Murillo, Liezybell", "7/1/26", "7:30", "17:30"],
  ["Ngo Roxanne", "14/01/2026", "8:30", "17:30"],
  ["Obedoza, Alejandro Joaquin", "2/1/26", "8:00", "17:00"],
  ["Reyes, Cherryl Grace", "5/1/26", "7:15", "16:15"],
  ["Rodriguez, Chrisanta", "7/1/26", "8:15", "17:15"], // Note: Database has "RODRIQUEZ"
  ["Siguen, Justine", "14/01/2026", "7:45", "16:45"],
  ["Sofranes Charlotte Jane", "2/1/26", "8:00", "17:00"],
  ["Solijon, Amy Ann", "5/1/26", "7:00", "16:00"],
  ["Suva, John Michael", "7/1/26", "8:30", "17:30"],
  ["Velasco, Xhalcy", "14/01/2026", "7:30", "16:30"],
];

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
  // Check if last name is similar (allowing for common spelling variations)
  if (excelLastName && excelLastName.length > 4) {
    for (const emp of allEmployees) {
      const empLast = normalizeName(emp.last_name || '');
      const empFirst = normalizeName(emp.first_name || '');
      const empFull = normalizeName(emp.full_name || '');

      // Check if last names are similar (same length or off by 1, and share most characters)
      if (Math.abs(empLast.length - excelLastName.length) <= 1) {
        // Count matching characters in same positions
        let charMatches = 0;
        const minLen = Math.min(empLast.length, excelLastName.length);
        for (let i = 0; i < minLen; i++) {
          if (empLast[i] === excelLastName[i]) charMatches++;
        }
        
        // If at least 80% of characters match and first name also matches
        if (charMatches >= minLen * 0.8) {
          if (empFirst.includes(excelFirstName) || excelFirstName.includes(empFirst) ||
              empFull.includes(excelFirstName) || (excelFirstName.length > 0 && empFull.includes(excelFirstName.substring(0, 4)))) {
            return { id: emp.id, full_name: emp.full_name, employee_id: emp.employee_id };
          }
        }
      }
    }
  }

  // Specific known name variations mapping (after normalization, commas are removed)
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

// Parse date in DD/MM/YYYY format
function parseDate(dateStr) {
  // Handle both "5/1/26" and "13/01/2026" formats
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
  // JavaScript Date months are 0-indexed
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return date;
}

// Parse time in HH:MM format
function parseTime(timeStr) {
  if (!timeStr || timeStr === 'OB') {
    return null;
  }

  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time: ${timeStr}`);
  }

  return { hours, minutes };
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
  console.log("JANUARY TIME LOGS IMPORT");
  console.log("=".repeat(80));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE IMPORT"}\n`);

  // Get office location
  const officeLoc = await getOfficeLocation();
  const locationString = `${officeLoc.lat.toFixed(6)}, ${officeLoc.lng.toFixed(6)}`;

  // Process entries
  const entries = [];
  const errors = [];
  const employeeCache = {};

  for (let i = 0; i < timeLogData.length; i++) {
    const [name, dateStr, timeInStr, timeOutStr] = timeLogData[i];

    try {
      // Parse date (DD/MM/YYYY format)
      const date = parseDate(dateStr);
      
      // Parse times
      const timeIn = parseTime(timeInStr);
      if (!timeIn) {
        errors.push({
          row: i + 1,
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
      if (timeOutStr && timeOutStr !== 'OB') {
        const timeOut = parseTime(timeOutStr);
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
      } else if (timeOutStr === 'OB') {
        // OB (Official Business): 8 hours from clock in
        clockOutDate = new Date(clockInDate);
        clockOutDate.setUTCHours(clockOutDate.getUTCHours() + 8);
      }

      // Validate clock out is after clock in
      if (clockOutDate && clockOutDate <= clockInDate) {
        errors.push({
          row: i + 1,
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
          row: i + 1,
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
        employee_notes: timeOutStr === 'OB' 
          ? 'OB - Official Business (8 hours)' 
          : `Imported from January time logs`
      };

      entries.push({
        ...entry,
        name: employee.full_name,
        employee_code: employee.employee_id,
        row: i + 1
      });

    } catch (error) {
      errors.push({
        row: i + 1,
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
    // Check for existing entries using Philippines timezone date
    // Convert clock_in_time to Philippines date for comparison
    const clockInDate = new Date(entry.clock_in_time);
    const phDate = new Date(clockInDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const phDateStr = phDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Query using date range that covers the entire day in Philippines timezone
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
        // Entry already exists, skip it
      } else {
        console.error(`  ❌ Error inserting ${entry.name}:`, error.message);
        failCount++;
      }
    } else {
      successCount++;
      if ((i + 1) % 5 === 0 || i === entriesToInsert.length - 1) {
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
