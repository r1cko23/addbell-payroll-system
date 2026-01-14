#!/usr/bin/env node
/**
 * Check Employee Attendance and Payslip
 * 
 * Checks an employee's time attendance vs payslip rest day calculations
 */

require('dotenv').config({ path: '.env.local' });
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

async function checkEmployeeAttendance() {
  const employeeId = process.argv[2] || '23318'; // Default to Shyna's employee ID
  const periodStart = process.argv[3] || '2026-01-01';
  const periodEnd = process.argv[4] || '2026-01-15';
  
  console.log("================================================================================");
  console.log("CHECKING EMPLOYEE ATTENDANCE vs PAYSLIP");
  console.log("================================================================================");
  console.log("");

  // Fetch employee
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, position, job_level, employee_type, per_day, monthly_rate")
    .eq("employee_id", employeeId)
    .single();

  if (empError || !employee) {
    console.error("Error fetching employee:", empError);
    process.exit(1);
  }

  console.log(`Employee: ${employee.full_name} (${employee.employee_id})`);
  console.log(`Position: ${employee.position || 'N/A'}`);
  console.log(`Job Level: ${employee.job_level || 'N/A'}`);
  console.log(`Employee Type: ${employee.employee_type || 'N/A'}`);
  console.log(`Period: ${periodStart} to ${periodEnd}`);
  console.log("");

  // Fetch time clock entries for the period
  console.log("TIME CLOCK ENTRIES:");
  console.log("--------------------------------------------------------------------------------");
  const { data: clockEntries, error: clockError } = await supabase
    .from("time_clock_entries")
    .select("id, clock_in_time, clock_out_time, total_hours, regular_hours, overtime_hours, status")
    .eq("employee_id", employee.id)
    .gte("clock_in_time", `${periodStart}T00:00:00`)
    .lte("clock_in_time", `${periodEnd}T23:59:59`)
    .order("clock_in_time", { ascending: true });

  if (clockError) {
    console.error("Error fetching clock entries:", clockError);
  } else if (!clockEntries || clockEntries.length === 0) {
    console.log("No clock entries found for this period.");
  } else {
    clockEntries.forEach((entry, idx) => {
      const clockIn = new Date(entry.clock_in_time);
      const clockOut = entry.clock_out_time ? new Date(entry.clock_out_time) : null;
      const dayOfWeek = clockIn.toLocaleDateString('en-US', { weekday: 'long' });
      const dateStr = clockIn.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      
      console.log(`${idx + 1}. ${dateStr} (${dayOfWeek})`);
      console.log(`   Clock In: ${clockIn.toLocaleTimeString('en-US', { hour12: true, timeZone: 'Asia/Manila' })}`);
      if (clockOut) {
        console.log(`   Clock Out: ${clockOut.toLocaleTimeString('en-US', { hour12: true, timeZone: 'Asia/Manila' })}`);
        const hours = entry.total_hours || 0;
        console.log(`   Total Hours: ${hours.toFixed(2)}`);
        console.log(`   Regular Hours: ${entry.regular_hours || 0}`);
        console.log(`   OT Hours: ${entry.overtime_hours || 0}`);
      } else {
        console.log(`   Status: ${entry.status} (No clock out)`);
      }
      console.log("");
    });
  }

  // Fetch weekly attendance records
  console.log("");
  console.log("WEEKLY ATTENDANCE RECORDS:");
  console.log("--------------------------------------------------------------------------------");
  const { data: attendanceRecords, error: attError } = await supabase
    .from("weekly_attendance")
    .select("id, period_start, period_end, attendance_data, total_regular_hours, total_overtime_hours")
    .eq("employee_id", employee.id)
    .gte("period_start", periodStart)
    .lte("period_end", periodEnd)
    .order("period_start", { ascending: true });

  if (attError) {
    console.error("Error fetching attendance records:", attError);
  } else if (!attendanceRecords || attendanceRecords.length === 0) {
    console.log("No weekly attendance records found for this period.");
  } else {
    attendanceRecords.forEach((record, idx) => {
      console.log(`${idx + 1}. Period: ${record.period_start} to ${record.period_end}`);
      console.log(`   Total Regular Hours: ${record.total_regular_hours || 0}`);
      console.log(`   Total OT Hours: ${record.total_overtime_hours || 0}`);
      
      if (record.attendance_data && Array.isArray(record.attendance_data)) {
        const restDays = record.attendance_data.filter((day) => 
          day.dayType === 'sunday' || 
          day.dayType === 'sunday-regular-holiday' ||
          day.dayType === 'sunday-special-holiday' ||
          (day.isRestDay && day.regularHours > 0)
        );
        
        if (restDays.length > 0) {
          console.log(`   Rest Day/Sunday Work Days:`);
          restDays.forEach((day) => {
            const date = new Date(day.date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            console.log(`     - ${day.date} (${dayName}): ${day.dayType || 'rest day'}, ${day.regularHours || 0} hours`);
          });
        } else {
          console.log(`   No rest day/Sunday work recorded in attendance_data`);
        }
      }
      console.log("");
    });
  }

  // Fetch payslips for the period
  console.log("");
  console.log("PAYSLIP RECORDS:");
  console.log("--------------------------------------------------------------------------------");
  const { data: payslips, error: payslipError } = await supabase
    .from("payslips")
    .select("id, payslip_number, period_start, period_end, earnings_breakdown, gross_pay")
    .eq("employee_id", employee.id)
    .gte("period_start", periodStart)
    .lte("period_end", periodEnd)
    .order("period_start", { ascending: true });

  if (payslipError) {
    console.error("Error fetching payslips:", payslipError);
  } else if (!payslips || payslips.length === 0) {
    console.log("No payslip records found for this period.");
  } else {
    payslips.forEach((payslip, idx) => {
      console.log(`${idx + 1}. Payslip #${payslip.payslip_number}`);
      console.log(`   Period: ${payslip.period_start} to ${payslip.period_end}`);
      console.log(`   Gross Pay: ₱${payslip.gross_pay?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}`);
      
      if (payslip.earnings_breakdown) {
        const breakdown = payslip.earnings_breakdown;
        
        // Check for rest day earnings
        if (breakdown.restDay) {
          console.log(`   Rest Day Earnings: ₱${breakdown.restDay.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
        }
        if (breakdown.restDayHours) {
          console.log(`   Rest Day Hours: ${breakdown.restDayHours}`);
        }
        
        // Check earnings breakdown table
        if (breakdown.earnings && Array.isArray(breakdown.earnings)) {
          const restDayEarnings = breakdown.earnings.filter((e) => 
            e.type === 'rest-day' || 
            e.type === 'sunday' ||
            (e.description && e.description.toLowerCase().includes('rest day')) ||
            (e.description && e.description.toLowerCase().includes('sunday'))
          );
          
          if (restDayEarnings.length > 0) {
            console.log(`   Rest Day Items in Earnings Breakdown:`);
            restDayEarnings.forEach((e) => {
              console.log(`     - ${e.description || e.type}: ${e.hours || 0} hours, ₱${(e.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`);
            });
          }
        }
        
        // Check other pay section
        if (breakdown.otherPay && Array.isArray(breakdown.otherPay)) {
          const restDayOtherPay = breakdown.otherPay.filter((p) => 
            (p.type && p.type.toLowerCase().includes('rest')) ||
            (p.description && p.description.toLowerCase().includes('rest'))
          );
          
          if (restDayOtherPay.length > 0) {
            console.log(`   Rest Day Items in Other Pay:`);
            restDayOtherPay.forEach((p) => {
              console.log(`     - ${p.description || p.type}: ₱${(p.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`);
            });
          }
        }
      }
      console.log("");
    });
  }

  console.log("================================================================================");
}

checkEmployeeAttendance()
  .then(() => {
    console.log("\nScript completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed:", error);
    process.exit(1);
  });
