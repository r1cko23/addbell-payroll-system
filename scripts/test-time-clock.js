#!/usr/bin/env node
/**
 * Test Script: Auto Record 8-Hour Shift
 * 
 * This script automatically creates a complete time clock entry for testing:
 * - Clocks in an employee at a specified time
 * - Clocks out 8 hours later (or at specified time)
 * - Automatically calculates hours via database triggers
 * 
 * Usage:
 *   npm run test:clock -- --employee-id 2014-027
 *   npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00"
 *   npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00" --hours 8
 *   npm run test:clock -- --employee-id 2014-027 --start-time "2025-01-15 08:00:00" --end-time "2025-01-15 17:00:00"
 * 
 * Options:
 *   --employee-id    Employee ID (e.g., "2014-027") - REQUIRED
 *   --start-time     Clock in time (default: current time)
 *   --end-time       Clock out time (default: start-time + 8 hours)
 *   --hours          Number of hours to work (default: 8)
 *   --location       Location coordinates "lat,lng" (default: uses first office location)
 *   --notes          Optional notes for the entry
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getEmployeeUUID(employeeId) {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, employee_id')
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error(`❌ Error: Employee with ID "${employeeId}" not found`);
    if (error) console.error('   Details:', error.message);
    return null;
  }

  console.log(`✅ Found employee: ${data.full_name} (${data.employee_id})`);
  return data.id;
}

async function getOfficeLocation() {
  const { data, error } = await supabase
    .from('office_locations')
    .select('latitude, longitude')
    .limit(1)
    .single();

  if (error || !data) {
    console.warn('⚠️  Warning: No office location found. Using default coordinates.');
    return { lat: 14.5995, lng: 120.9842 }; // Default: Manila, Philippines
  }

  return { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) };
}

function parseDateTime(dateTimeStr) {
  // Try multiple formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/,
  ];

  for (const format of formats) {
    const match = dateTimeStr.match(format);
    if (match) {
      if (format === formats[0] || format === formats[1]) {
        // YYYY-MM-DD format
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        const hour = parseInt(match[4] || 0);
        const minute = parseInt(match[5] || 0);
        const second = parseInt(match[6] || 0);
        return new Date(year, month, day, hour, minute, second);
      } else if (format === formats[2]) {
        // YYYY-MM-DD only
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        return new Date(year, month, day, 8, 0, 0); // Default to 8 AM
      } else {
        // MM/DD/YYYY format
        const month = parseInt(match[1]) - 1;
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);
        const hour = parseInt(match[4] || 0);
        const minute = parseInt(match[5] || 0);
        const second = parseInt(match[6] || 0);
        return new Date(year, month, day, hour, minute, second);
      }
    }
  }

  // Fallback to Date constructor
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateTimeStr}`);
  }
  return date;
}

async function createTimeClockEntry(options) {
  console.log('\n🕐 Creating Time Clock Entry...\n');

  // Get employee UUID
  const employeeUUID = await getEmployeeUUID(options.employeeId);
  if (!employeeUUID) {
    process.exit(1);
  }

  // Parse times
  const clockInTime = options.startTime 
    ? parseDateTime(options.startTime)
    : new Date();

  let clockOutTime;
  if (options.endTime) {
    clockOutTime = parseDateTime(options.endTime);
  } else {
    const hours = options.hours || 8;
    clockOutTime = new Date(clockInTime.getTime() + hours * 60 * 60 * 1000);
  }

  // Validate times
  if (clockOutTime <= clockInTime) {
    console.error('❌ Error: Clock out time must be after clock in time');
    process.exit(1);
  }

  // Get location
  let locationString;
  if (options.location) {
    locationString = options.location;
  } else {
    const officeLoc = await getOfficeLocation();
    locationString = `${officeLoc.lat.toFixed(6)}, ${officeLoc.lng.toFixed(6)}`;
  }

  // Calculate total hours (for display)
  const totalMs = clockOutTime.getTime() - clockInTime.getTime();
  const totalHours = totalMs / (1000 * 60 * 60);

  console.log('📋 Entry Details:');
  console.log(`   Employee ID: ${options.employeeId}`);
  console.log(`   Clock In:     ${clockInTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
  console.log(`   Clock Out:    ${clockOutTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
  console.log(`   Total Hours:  ${totalHours.toFixed(2)} hours`);
  console.log(`   Location:     ${locationString}`);
  if (options.notes) {
    console.log(`   Notes:        ${options.notes}`);
  }
  console.log('');

  // Create the time clock entry
  const { data, error } = await supabase
    .from('time_clock_entries')
    .insert({
      employee_id: employeeUUID,
      clock_in_time: clockInTime.toISOString(),
      clock_in_location: locationString,
      clock_out_time: clockOutTime.toISOString(),
      clock_out_location: locationString,
      employee_notes: options.notes || null,
      clock_in_device: 'Test Script',
      clock_out_device: 'Test Script',
      status: 'clocked_out', // Will be auto-updated to 'auto_approved' by trigger
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating time clock entry:', error.message);
    console.error('   Details:', error);
    process.exit(1);
  }

  console.log('✅ Time clock entry created successfully!');
  console.log(`   Entry ID: ${data.id}`);
  console.log(`   Status: ${data.status}`);
  
  // Wait a moment for triggers to calculate hours
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Fetch updated entry to see calculated hours
  const { data: updatedEntry, error: fetchError } = await supabase
    .from('time_clock_entries')
    .select('total_hours, regular_hours, overtime_hours, night_diff_hours, status')
    .eq('id', data.id)
    .single();

  if (!fetchError && updatedEntry) {
    console.log('\n📊 Calculated Hours:');
    console.log(`   Total Hours:    ${updatedEntry.total_hours || 0} hours`);
    console.log(`   Regular Hours:  ${updatedEntry.regular_hours || 0} hours`);
    console.log(`   Overtime Hours: ${updatedEntry.overtime_hours || 0} hours`);
    console.log(`   Night Diff:     ${updatedEntry.night_diff_hours || 0} hours`);
    console.log(`   Final Status:   ${updatedEntry.status}`);
  }

  console.log('\n✨ Done! Check the employee portal or time entries page to see the entry.\n');
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--employee-id':
      case '-e':
        if (nextArg) {
          options.employeeId = nextArg;
          i++;
        }
        break;
      case '--start-time':
      case '-s':
        if (nextArg) {
          options.startTime = nextArg;
          i++;
        }
        break;
      case '--end-time':
      case '-t':
        if (nextArg) {
          options.endTime = nextArg;
          i++;
        }
        break;
      case '--hours':
      case '-h':
        if (nextArg) {
          options.hours = parseFloat(nextArg);
          i++;
        }
        break;
      case '--location':
      case '-l':
        if (nextArg) {
          options.location = nextArg;
          i++;
        }
        break;
      case '--notes':
      case '-n':
        if (nextArg) {
          options.notes = nextArg;
          i++;
        }
        break;
      case '--help':
        console.log(`
Usage: npm run test:clock -- [options]

Options:
  --employee-id, -e    Employee ID (e.g., "2014-027") - REQUIRED
  --start-time, -s     Clock in time (format: "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD")
                       Default: current time
  --end-time, -t       Clock out time (format: "YYYY-MM-DD HH:mm:ss")
                       Default: start-time + 8 hours
  --hours, -h          Number of hours to work (default: 8)
                       Ignored if --end-time is provided
  --location, -l       Location coordinates "lat,lng" (e.g., "14.5995,120.9842")
                       Default: uses first office location from database
  --notes, -n          Optional notes for the entry

Examples:
  # Clock in now, clock out 8 hours later
  npm run test:clock -- -e 2014-027

  # Clock in at specific time, work 8 hours
  npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00"

  # Clock in and out at specific times
  npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00" -t "2025-01-15 17:00:00"

  # Work 10 hours instead of 8
  npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00" -h 10

  # With custom location and notes
  npm run test:clock -- -e 2014-027 -s "2025-01-15 08:00:00" -l "14.5995,120.9842" -n "Test entry"
        `);
        process.exit(0);
    }
  }

  if (!options.employeeId) {
    console.error('❌ Error: --employee-id is required');
    console.error('   Use --help for usage information');
    process.exit(1);
  }

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();
  await createTimeClockEntry(options);
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});