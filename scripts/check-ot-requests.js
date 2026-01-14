#!/usr/bin/env node
/**
 * Check OT Requests for Employee
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

async function checkOTRequests() {
  const employeeId = process.argv[2] || '23318';
  const periodStart = process.argv[3] || '2026-01-01';
  const periodEnd = process.argv[4] || '2026-01-15';
  
  console.log("================================================================================");
  console.log("CHECKING OT REQUESTS");
  console.log("================================================================================");
  console.log("");

  // Fetch employee
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, employee_id, full_name")
    .eq("employee_id", employeeId)
    .single();

  if (empError || !employee) {
    console.error("Error fetching employee:", empError);
    process.exit(1);
  }

  console.log(`Employee: ${employee.full_name} (${employee.employee_id})`);
  console.log(`Period: ${periodStart} to ${periodEnd}`);
  console.log("");

  // Fetch approved OT requests
  const { data: otRequests, error: otError } = await supabase
    .from("overtime_requests")
    .select("id, ot_date, start_time, end_time, total_hours, status")
    .eq("employee_id", employee.id)
    .gte("ot_date", periodStart)
    .lte("ot_date", periodEnd)
    .in("status", ["approved", "approved_by_manager", "approved_by_hr"])
    .order("ot_date", { ascending: true });

  if (otError) {
    console.error("Error fetching OT requests:", otError);
    process.exit(1);
  }

  if (!otRequests || otRequests.length === 0) {
    console.log("No approved OT requests found for this period.");
  } else {
    console.log(`Found ${otRequests.length} approved OT request(s):\n`);
    let totalOTHours = 0;
    
    otRequests.forEach((ot, idx) => {
      console.log(`${idx + 1}. Date: ${ot.ot_date}`);
      console.log(`   Start Time: ${ot.start_time || 'N/A'}`);
      console.log(`   End Time: ${ot.end_time || 'N/A'}`);
      console.log(`   Total Hours: ${ot.total_hours || 0}`);
      console.log(`   Status: ${ot.status}`);
      console.log("");
      totalOTHours += parseFloat(ot.total_hours || 0);
    });
    
    console.log(`Total OT Hours: ${totalOTHours.toFixed(2)}`);
    console.log("");
    console.log(`Expected OT Allowance (Supervisory):`);
    if (totalOTHours >= 2) {
      const allowance = 200 + (totalOTHours - 2) * 100;
      console.log(`  Formula: ₱200 (first 2 hours) + ₱100 × (${totalOTHours.toFixed(2)} - 2) hours`);
      console.log(`  = ₱200 + ₱${((totalOTHours - 2) * 100).toFixed(2)}`);
      console.log(`  = ₱${allowance.toFixed(2)}`);
    } else {
      console.log(`  Less than 2 hours: ₱0`);
    }
  }

  console.log("");
  console.log("================================================================================");
}

checkOTRequests()
  .then(() => {
    console.log("\nScript completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed:", error);
    process.exit(1);
  });
