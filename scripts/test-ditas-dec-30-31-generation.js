const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const { generateTimesheetFromClockEntries } = require('../lib/timesheet-auto-generator');
const { parseISO, format } = require('date-fns');

async function testDitasDec30_31() {
  console.log('='.repeat(80));
  console.log('Testing DITAS Dec 30-31 Holiday Generation');
  console.log('='.repeat(80));

  // Get DITAS employee
  const { data: emp } = await supabase
    .from('employees')
    .select('id, employee_id, full_name')
    .eq('employee_id', '23373')
    .single();

  console.log('\nEmployee:', emp);

  // Load clock entries
  const { data: clockEntries } = await supabase
    .from('time_clock_entries')
    .select('*')
    .eq('employee_id', emp.id)
    .gte('clock_in_time', '2025-12-16')
    .lte('clock_in_time', '2025-12-31T23:59:59')
    .order('clock_in_time');

  console.log('\nClock entries:', clockEntries.length);
  clockEntries.forEach(e => {
    const d = new Date(e.clock_in_time).toISOString().split('T')[0];
    console.log(`  ${d}: ${e.regular_hours || 0} hours, status: ${e.status}`);
  });

  // Load holidays
  const { data: holidaysData } = await supabase
    .from('holidays')
    .select('holiday_date, name, is_regular')
    .gte('holiday_date', '2025-12-16')
    .lte('holiday_date', '2025-12-31');

  const holidays = holidaysData.map(h => ({
    holiday_date: h.holiday_date,
    holiday_type: h.is_regular ? 'regular' : 'non-working',
  }));

  console.log('\nHolidays:', holidays);

  // Generate attendance
  const periodStart = parseISO('2025-12-16');
  const periodEnd = parseISO('2025-12-31');
  const restDaysMap = new Map();

  const timesheetData = generateTimesheetFromClockEntries(
    clockEntries,
    periodStart,
    periodEnd,
    holidays,
    restDaysMap,
    true, // eligibleForOT
    true, // eligibleForNightDiff
    false // isClientBasedAccountSupervisor
  );

  console.log('\nGenerated attendance data:');
  const dec30 = timesheetData.attendance_data.find(d => d.date === '2025-12-30');
  const dec31 = timesheetData.attendance_data.find(d => d.date === '2025-12-31');

  console.log('\nDec 30:', JSON.stringify(dec30, null, 2));
  console.log('\nDec 31:', JSON.stringify(dec31, null, 2));

  console.log('\nTotal regular hours:', timesheetData.total_regular_hours);
  console.log('Days Work (total_regular_hours / 8):', timesheetData.total_regular_hours / 8);

  // Check all days
  console.log('\nAll days in period:');
  timesheetData.attendance_data.forEach(day => {
    if (day.date >= '2025-12-28') {
      console.log(`  ${day.date}: ${day.dayType}, ${day.regularHours} hours`);
    }
  });
}

testDitasDec30_31().catch(console.error);

