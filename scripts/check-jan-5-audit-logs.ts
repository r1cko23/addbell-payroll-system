/**
 * Script to check audit_logs table for Jan 5, 2026 activity
 * Also provides instructions for checking Supabase Postgres logs
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuditLogs() {
  console.log("\n🔍 Checking audit_logs table for Jan 5, 2026 activity...\n");

  const targetDate = "2026-01-05";
  const targetDateStart = `${targetDate}T00:00:00+08:00`;
  const targetDateEnd = `${targetDate}T23:59:59+08:00`;

  // Check audit_logs table
  const { data: auditLogs, error: auditError } = await supabase
    .from("audit_logs")
    .select("*")
    .gte("created_at", targetDateStart)
    .lte("created_at", targetDateEnd)
    .order("created_at", { ascending: true });

  if (auditError) {
    console.error("Error fetching audit logs:", auditError);
    console.log("   (This might be expected if RLS restricts access)\n");
  } else {
    console.log(`Found ${auditLogs?.length || 0} audit log entries for Jan 5, 2026\n`);

    if (auditLogs && auditLogs.length > 0) {
      console.log("Sample entries:");
      auditLogs.slice(0, 10).forEach((log, idx) => {
        console.log(`   ${idx + 1}. [${log.created_at}] ${log.action} on ${log.table_name}`);
        if (log.action_description) {
          console.log(`      Description: ${log.action_description}`);
        }
      });
      if (auditLogs.length > 10) {
        console.log(`   ... and ${auditLogs.length - 10} more entries\n`);
      } else {
        console.log();
      }
    } else {
      console.log("   ⚠️  No audit logs found for Jan 5\n");
      console.log("   Note: Audit logs may not capture RPC function errors\n");
    }
  }

  // Check failure_to_log requests for Jan 5
  console.log("Checking failure_to_log requests for Jan 5...");
  const { data: failureToLogRequests, error: ftlError } = await supabase
    .from("failure_to_log")
    .select("id, employee_id, missed_date, status, created_at, reason")
    .eq("missed_date", targetDate)
    .order("created_at", { ascending: true });

  if (ftlError) {
    console.error("Error fetching failure to log requests:", ftlError);
  } else {
    console.log(`Found ${failureToLogRequests?.length || 0} failure-to-log requests for Jan 5\n`);

    if (failureToLogRequests && failureToLogRequests.length > 0) {
      // Get employee names
      const employeeIds = [...new Set(failureToLogRequests.map(r => r.employee_id))];
      const { data: employees } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .in("id", employeeIds);

      const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

      console.log("Failure-to-log requests:");
      failureToLogRequests.forEach((request, idx) => {
        const emp = employeeMap.get(request.employee_id);
        console.log(`   ${idx + 1}. ${emp?.full_name || request.employee_id}: ${request.status}`);
        console.log(`      Reason: ${request.reason?.substring(0, 60) || "N/A"}...`);
        console.log(`      Created: ${request.created_at}`);
      });
      console.log();
    }
  }

  // Summary and instructions
  console.log("\n📋 How to Check Supabase Postgres Logs:");
  console.log("   ============================================");
  console.log("   1. Go to: https://supabase.com/dashboard");
  console.log("   2. Select your project");
  console.log("   3. Navigate to: Logs > Postgres Logs");
  console.log("   4. Filter by date: 2026-01-05");
  console.log("   5. Search for these keywords:");
  console.log("      - 'employee_clock_in'");
  console.log("      - 'clock_in_now'");
  console.log("      - 'ERROR'");
  console.log("      - 'EXCEPTION'");
  console.log("      - 'rest day'");
  console.log("      - 'Cannot clock in'");
  console.log("   6. Look for patterns:");
  console.log("      - Multiple failed RPC calls");
  console.log("      - Database connection errors");
  console.log("      - Permission denied errors");
  console.log("      - Rest day check failures");
  console.log("\n   Alternative: Check Application Logs");
  console.log("   ============================================");
  console.log("   1. Go to: Logs > API Logs");
  console.log("   2. Filter by date: 2026-01-05");
  console.log("   3. Look for:");
  console.log("      - POST requests to /rest/v1/rpc/employee_clock_in");
  console.log("      - Error responses (4xx, 5xx)");
  console.log("      - Response times (slow requests)");
  console.log("\n   Note: Application-level errors are logged to browser console");
  console.log("   but not persisted unless you have error tracking (Sentry, etc.)");
}

checkAuditLogs()
  .then(() => {
    console.log("\n✨ Analysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });