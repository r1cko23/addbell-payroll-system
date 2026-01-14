#!/usr/bin/env node
/**
 * Check Employee Rate
 * 
 * Checks an employee's current daily rate and job level
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

async function checkEmployeeRate() {
  const employeeId = process.argv[2] || '23318'; // Default to Shyna's employee ID
  
  console.log("================================================================================");
  console.log("CHECKING EMPLOYEE RATE");
  console.log("================================================================================");
  console.log("");

  // Fetch employee by employee_id
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, employee_id, full_name, position, job_level, monthly_rate, per_day, employee_type")
    .eq("employee_id", employeeId)
    .single();

  if (error) {
    console.error("Error fetching employee:", error);
    process.exit(1);
  }

  if (!employee) {
    console.error(`Employee with ID ${employeeId} not found`);
    process.exit(1);
  }

  console.log("Employee Information:");
  console.log(`  Employee ID: ${employee.employee_id}`);
  console.log(`  Full Name: ${employee.full_name}`);
  console.log(`  Position: ${employee.position || 'N/A'}`);
  console.log(`  Job Level: ${employee.job_level || 'N/A'}`);
  console.log(`  Employee Type: ${employee.employee_type || 'N/A'}`);
  console.log("");
  console.log("Rate Information:");
  console.log(`  Monthly Rate: ${employee.monthly_rate ? `₱${employee.monthly_rate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'}`);
  console.log(`  Daily Rate (per_day): ${employee.per_day ? `₱${employee.per_day.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'}`);
  
  if (employee.per_day) {
    const hourlyRate = employee.per_day / 8;
    console.log(`  Hourly Rate (calculated): ₱${hourlyRate.toLocaleString('en-US', {minimumFractionDigits: 3, maximumFractionDigits: 3})}`);
  }

  if (employee.monthly_rate) {
    const dailyFromMonthly = employee.monthly_rate / 26;
    const hourlyFromMonthly = dailyFromMonthly / 8;
    console.log(`  Daily Rate (from monthly): ₱${dailyFromMonthly.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`  Hourly Rate (from monthly): ₱${hourlyFromMonthly.toLocaleString('en-US', {minimumFractionDigits: 3, maximumFractionDigits: 3})}`);
  }

  console.log("");
  
  // Check if job level matches rate
  if (employee.job_level && employee.job_level.toUpperCase() === 'SUPERVISORY') {
    console.log("⚠️  WARNING: Employee has SUPERVISORY job level");
    if (employee.per_day && employee.per_day < 2000) {
      console.log("⚠️  Daily rate appears to be rank-and-file rate (< ₱2,000)");
      console.log("   This may need to be updated to a supervisory rate.");
    }
  }

  // Compare with other supervisory employees
  console.log("");
  console.log("Comparing with other supervisory employees:");
  const { data: supervisoryEmployees, error: supError } = await supabase
    .from("employees")
    .select("employee_id, full_name, position, job_level, per_day, monthly_rate")
    .eq("is_active", true)
    .or(`job_level.eq.SUPERVISORY,job_level.eq.MANAGERIAL`)
    .limit(10);

  if (!supError && supervisoryEmployees && supervisoryEmployees.length > 0) {
    supervisoryEmployees.forEach(emp => {
      if (emp.employee_id !== employeeId) {
        const rate = emp.per_day || (emp.monthly_rate ? emp.monthly_rate / 26 : null);
        console.log(`  ${emp.full_name} (${emp.job_level}): ${rate ? `₱${rate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'}`);
      }
    });
  }

  console.log("");
  console.log("================================================================================");
}

checkEmployeeRate()
  .then(() => {
    console.log("\nScript completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed:", error);
    process.exit(1);
  });
