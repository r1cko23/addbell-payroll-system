#!/usr/bin/env node
/**
 * Update Specific Time Logs
 *
 * Updates specific employee time entries:
 * - Mae and Xhalcy: Half day, clock out at 13:00
 * - Nicole C.: Clock out at 14:18
 * - Fatima/Angeline: OB (Official Business), give full 8 hrs
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Convert Excel serial date to JavaScript Date (same logic as import script)
function excelDateToJSDate(serial) {
  const dateObj = XLSX.SSF.parse_date_code(serial);
  if (!dateObj) {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + serial * 86400000);
  }

  // Correct for day/month/year format issue
  if (dateObj.y === 2026 && dateObj.m === 2) {
    const datePart = Math.floor(serial);
    const timePart = serial - datePart;
    const correctedDateSerial = datePart - 30 + timePart;
    const correctedDateObj = XLSX.SSF.parse_date_code(correctedDateSerial);
    if (correctedDateObj && correctedDateObj.y === 2026 && correctedDateObj.m === 1) {
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

  return new Date(
    dateObj.y,
    dateObj.m - 1,
    dateObj.d,
    dateObj.H || 0,
    dateObj.M || 0,
    dateObj.S || 0
  );
}

// Convert Excel time fraction to hours/minutes
function excelTimeToTime(timeFraction) {
  const totalSeconds = Math.round(timeFraction * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return { hours, minutes };
}

// Build full_name from first_name + last_name (Addbell uses separate columns)
function getFullName(emp) {
  return [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim();
}

// Find employee by name (fuzzy match)
async function findEmployeeByName(name) {
  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, employee_id, last_name, first_name")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching employees:", error);
    return null;
  }

  const normalizedSearch = name.toLowerCase().trim();

  // Try exact match first
  let match = employees.find(emp => {
    const fullName = getFullName(emp).toLowerCase();
    const firstLast = emp.first_name && emp.last_name
      ? `${emp.first_name} ${emp.last_name}`.toLowerCase()
      : "";
    const lastFirst = emp.last_name && emp.first_name
      ? `${emp.last_name}, ${emp.first_name}`.toLowerCase()
      : "";
    return fullName === normalizedSearch || firstLast === normalizedSearch || lastFirst === normalizedSearch;
  });

  if (match) return { ...match, full_name: getFullName(match) };

  // Try partial match
  match = employees.find(emp => {
    const fullName = getFullName(emp).toLowerCase();
    const parts = normalizedSearch.split(/[\s,]+/).filter(p => p.length > 0);
    return parts.every(part => fullName.includes(part));
  });

  return match ? { ...match, full_name: getFullName(match) } : null;
}

async function updateTimeLogs() {
  console.log("================================================================================");
  console.log("UPDATING SPECIFIC TIME LOGS");
  console.log("================================================================================");
  console.log("");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("(DRY RUN MODE - No changes will be made)\n");
  }

  // Read Excel file
  const excelFile = path.join(__dirname, "..", "Timelogs Jan 2 - 4, 2026.xlsx");
  if (!fs.existsSync(excelFile)) {
    console.error("Excel file not found:", excelFile);
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelFile);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 });

  // Find header row
  let headerRowIndex = 0;
  const firstRow = data[0] || [];
  const hasHeaderKeywords = firstRow.some(cell =>
    cell && typeof cell === 'string' &&
    (cell.toLowerCase().includes('name') ||
     cell.toLowerCase().includes('date') ||
     cell.toLowerCase().includes('clock'))
  );
  if (!hasHeaderKeywords && data.length > 1) {
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

  console.log(`Found ${rows.length} data rows in Excel file\n`);

  // Fetch all employees once (Addbell uses first_name + last_name, not full_name)
  const { data: allEmployees, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, last_name, first_name")
    .eq("is_active", true);

  if (empError) {
    console.error("Error fetching employees:", empError);
    process.exit(1);
  }

  // Employee update rules - more specific patterns to avoid false matches
  const updateRules = [
    {
      namePatterns: ["mae chan shai", "angeles, mae"],
      description: "Mae Chan Shai Angeles - Half day, clock out at 13:00",
      clockOutTime: { hours: 13, minutes: 0 }
    },
    {
      namePatterns: ["xhalcy", "velasco, xhalcy"],
      description: "Xhalcy Velasco - Half day, clock out at 13:00",
      clockOutTime: { hours: 13, minutes: 0 }
    },
    {
      namePatterns: ["mary nicole", "corpuz, mary nicole", "nicole.*corpuz"],
      description: "Mary Nicole Corpuz - Clock out at 14:18",
      clockOutTime: { hours: 14, minutes: 18 }
    },
    {
      namePatterns: ["fatima.*samson", "samson.*fatima"],
      description: "Fatima Samson - OB (Official Business), full 8 hrs",
      isOB: true,
      fullHours: 8
    },
    {
      namePatterns: ["angeline.*hernani", "hernani.*angeline"],
      description: "Angeline Hernani - OB (Official Business), full 8 hrs",
      isOB: true,
      fullHours: 8
    }
  ];

  let totalUpdated = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  // Process each row
  for (const row of rows) {
    const employeeName = row[0];
    if (!employeeName) continue;

    const dateSerial = row[1];
    if (!dateSerial) continue;

    const clockInTime = row[2];
    const clockOutTime = row[3];

    // Convert date using the same logic as import script
    const dateObj = excelDateToJSDate(dateSerial);
    // Format date as YYYY-MM-DD in local timezone (not UTC)
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Find matching update rule
    const normalizedName = employeeName.toLowerCase().trim();
    const rule = updateRules.find(r =>
      r.namePatterns.some(pattern => {
        // Support regex patterns or simple string matching
        if (pattern.includes('.*') || pattern.includes('|')) {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(normalizedName);
          } catch (e) {
            return normalizedName.includes(pattern.toLowerCase());
          }
        }
        return normalizedName.includes(pattern.toLowerCase());
      })
    );

    if (!rule) continue;

    // Find employee
    const employee = await findEmployeeByName(employeeName);
    if (!employee) {
      console.log(`⚠️  Employee not found: ${employeeName}`);
      totalSkipped++;
      continue;
    }

    console.log(`\nProcessing: ${employee.full_name} (${employee.employee_id})`);
    console.log(`  Date: ${dateStr}`);
    console.log(`  Rule: ${rule.description}`);

    // Find existing entry for this date
    const dateStart = new Date(dateStr + "T00:00:00");
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStr + "T23:59:59");
    dateEnd.setHours(23, 59, 59, 999);

    const { data: existingEntries, error: fetchError } = await supabase
      .from("time_clock_entries")
      .select("id, clock_in_time, clock_out_time, status")
      .eq("employee_id", employee.id)
      .gte("clock_in_time", dateStart.toISOString())
      .lte("clock_in_time", dateEnd.toISOString())
      .order("clock_in_time", { ascending: true });

    if (fetchError) {
      console.error(`  ❌ Error fetching entries:`, fetchError);
      totalErrors++;
      continue;
    }

    if (!existingEntries || existingEntries.length === 0) {
      console.log(`  ⚠️  No entries found for this date`);

      // Check if Excel has clock in/out data
      const excelClockIn = clockInTime !== null && clockInTime !== undefined;
      const excelClockOut = clockOutTime !== null && clockOutTime !== undefined;

      // For OB employees, create entry if none exists
      if (rule.isOB) {
        // Use Excel clock in if available, otherwise default to 8 AM
        let clockInDate;
        if (excelClockIn) {
          const timeObj = excelTimeToTime(clockInTime);
          clockInDate = new Date(dateStr + `T${String(timeObj.hours).padStart(2, '0')}:${String(timeObj.minutes).padStart(2, '0')}:00+08:00`);
        } else {
          clockInDate = new Date(dateStr + "T08:00:00+08:00"); // Default 8 AM Manila time
        }

        // Clock out is 8 hours after clock in
        const clockOutDate = new Date(clockInDate);
        clockOutDate.setHours(clockInDate.getHours() + rule.fullHours);

        if (!dryRun) {
          const { error: insertError } = await supabase
            .from("time_clock_entries")
            .insert({
              employee_id: employee.id,
              clock_in_time: clockInDate.toISOString(),
              clock_out_time: clockOutDate.toISOString(),
              status: "auto_approved",
              is_manual_entry: true,
              employee_notes: "OB - Official Business (8 hours)"
            });

          if (insertError) {
            console.error(`  ❌ Error creating OB entry:`, insertError);
            totalErrors++;
          } else {
            console.log(`  ✅ Created OB entry: ${clockInDate.toISOString()} to ${clockOutDate.toISOString()}`);
            totalUpdated++;
          }
        } else {
          console.log(`  🔍 Would create OB entry: ${clockInDate.toISOString()} to ${clockOutDate.toISOString()}`);
          totalUpdated++;
        }
      } else if (excelClockIn || excelClockOut) {
        // For non-OB employees, if Excel has data but no entry exists, create entry
        let clockInDate;
        if (excelClockIn) {
          // Use Excel clock in time
          const timeObj = excelTimeToTime(clockInTime);
          const manilaTimeStr = `${dateStr}T${String(timeObj.hours).padStart(2, '0')}:${String(timeObj.minutes).padStart(2, '0')}:00+08:00`;
          clockInDate = new Date(manilaTimeStr);
        } else {
          // If only clock out exists, for half day set clock in to 4 hours before clock out time
          // But use rule's clock out time instead of Excel clock out
          const clockOutTimeObj = rule.clockOutTime;
          const clockInHours = Math.max(8, clockOutTimeObj.hours - 4); // At least 8 AM
          const manilaTimeStr = `${dateStr}T${String(clockInHours).padStart(2, '0')}:${String(clockOutTimeObj.minutes).padStart(2, '0')}:00+08:00`;
          clockInDate = new Date(manilaTimeStr);
        }

        // Set clock out time based on rule (Manila timezone)
        const manilaClockOutStr = `${dateStr}T${String(rule.clockOutTime.hours).padStart(2, '0')}:${String(rule.clockOutTime.minutes).padStart(2, '0')}:00+08:00`;
        const clockOutDate = new Date(manilaClockOutStr);

        if (!dryRun) {
          const { error: insertError } = await supabase
            .from("time_clock_entries")
            .insert({
              employee_id: employee.id,
              clock_in_time: clockInDate.toISOString(),
              clock_out_time: clockOutDate.toISOString(),
              status: "auto_approved",
              is_manual_entry: true
            });

          if (insertError) {
            console.error(`  ❌ Error creating entry:`, insertError);
            totalErrors++;
          } else {
            console.log(`  ✅ Created entry: ${clockInDate.toISOString()} to ${clockOutDate.toISOString()}`);
            totalUpdated++;
          }
        } else {
          console.log(`  🔍 Would create entry: ${clockInDate.toISOString()} to ${clockOutDate.toISOString()}`);
          totalUpdated++;
        }
      } else {
        totalSkipped++;
      }
      continue;
    }

    // Update each entry for this date
    for (const entry of existingEntries) {
      const clockInDate = new Date(entry.clock_in_time);

      if (rule.isOB) {
        // OB: Set clock out to 8 hours after clock in (preserve date)
        const clockOutDate = new Date(clockInDate);
        const clockInDateOnly = new Date(clockInDate.getFullYear(), clockInDate.getMonth(), clockInDate.getDate());
        clockOutDate.setFullYear(clockInDateOnly.getFullYear());
        clockOutDate.setMonth(clockInDateOnly.getMonth());
        clockOutDate.setDate(clockInDateOnly.getDate());
        clockOutDate.setHours(clockInDate.getHours() + rule.fullHours);
        clockOutDate.setMinutes(clockInDate.getMinutes());
        clockOutDate.setSeconds(0);
        clockOutDate.setMilliseconds(0);

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("time_clock_entries")
            .update({
              clock_out_time: clockOutDate.toISOString(),
              employee_notes: entry.employee_notes ?
                `${entry.employee_notes}; OB - Official Business (8 hours)` :
                "OB - Official Business (8 hours)",
              is_manual_entry: true
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`  ❌ Error updating entry ${entry.id}:`, updateError);
            totalErrors++;
          } else {
            console.log(`  ✅ Updated entry: Clock out set to ${clockOutDate.toISOString()}`);
            totalUpdated++;
          }
        } else {
          console.log(`  🔍 Would update entry: Clock out to ${clockOutDate.toISOString()}`);
          totalUpdated++;
        }
      } else if (rule.clockOutTime) {
        // Set specific clock out time on the same date as clock in (Manila timezone)
        const clockInDateManila = new Date(clockInDate.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
        const clockOutDate = new Date(clockInDate);
        const clockInDateOnly = new Date(clockInDate.getFullYear(), clockInDate.getMonth(), clockInDate.getDate());
        clockOutDate.setFullYear(clockInDateOnly.getFullYear());
        clockOutDate.setMonth(clockInDateOnly.getMonth());
        clockOutDate.setDate(clockInDateOnly.getDate());
        // Set time in Manila timezone - convert to UTC for storage
        const manilaTimeStr = `${dateStr}T${String(rule.clockOutTime.hours).padStart(2, '0')}:${String(rule.clockOutTime.minutes).padStart(2, '0')}:00+08:00`;
        const clockOutDateManila = new Date(manilaTimeStr);
        clockOutDate.setTime(clockOutDateManila.getTime());

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("time_clock_entries")
            .update({
              clock_out_time: clockOutDate.toISOString(),
              is_manual_entry: true
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`  ❌ Error updating entry ${entry.id}:`, updateError);
            totalErrors++;
          } else {
            console.log(`  ✅ Updated entry: Clock out set to ${clockOutDate.toISOString()}`);
            totalUpdated++;
          }
        } else {
          console.log(`  🔍 Would update entry: Clock out to ${clockOutDate.toISOString()}`);
          totalUpdated++;
        }
      }
    }
  }

  console.log("\n================================================================================");
  console.log("SUMMARY");
  console.log("================================================================================");
  console.log(`Total entries updated: ${totalUpdated}`);
  console.log(`Total entries skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log("");

  if (dryRun) {
    console.log("(DRY RUN - No changes were made)");
  } else {
    console.log("✅ Updates completed!");
  }
}

updateTimeLogs()
  .then(() => {
    console.log("\nScript completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed:", error);
    process.exit(1);
  });
