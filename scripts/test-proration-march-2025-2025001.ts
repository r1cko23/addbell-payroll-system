/**
 * One-off / regression helper: employee 2025001, March 2025 statutory proration.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Run: npx tsx scripts/test-proration-march-2025-2025001.ts
 * Cleanup test punches: npx tsx scripts/test-proration-march-2025-2025001.ts --cleanup
 */

import { config } from "dotenv";
import path from "path";
import { format } from "date-fns";
import { createClient } from "@supabase/supabase-js";
import {
  applyStatutoryProration,
  fetchDistinctWorkDaysMonthToDate,
  statutoryProrationFactorFromDays,
  STATUTORY_PRORATION_REFERENCE_DAYS,
} from "../lib/statutory-proration";
import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateMonthlySalary,
} from "../utils/ph-deductions";
import { isFourthStatutoryWeeklyPay } from "../lib/weekly-statutory-deductions";

config({ path: path.join(__dirname, "../.env.local") });

const EMPLOYEE_CODE = "2025001";
const PERIOD_END_TUESDAY = new Date(2025, 2, 25); // March 25, 2025 (Tuesday)
PERIOD_END_TUESDAY.setHours(0, 0, 0, 0);

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, employee_code, first_name, last_name, base_rate, salary_basis")
    .eq("employee_code", EMPLOYEE_CODE)
    .maybeSingle();

  if (empErr || !emp) {
    console.error("Employee not found:", empErr?.message);
    process.exit(1);
  }

  const employeeId = emp.id as string;

  if (cleanup) {
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("employee_id", employeeId)
      .eq("device_info", "PRORATION_TEST_MARCH_2025");
    console.log(
      error ? `Cleanup error: ${error.message}` : "Removed PRORATION_TEST_MARCH_2025 punches."
    );
    process.exit(error ? 1 : 0);
  }

  const perDay = Number(emp.base_rate ?? 0);
  const monthlySalary =
    emp.salary_basis === "monthly"
      ? perDay
      : calculateMonthlySalary(perDay, STATUTORY_PRORATION_REFERENCE_DAYS);

  const mtdDays = await fetchDistinctWorkDaysMonthToDate(
    supabase,
    [employeeId],
    PERIOD_END_TUESDAY
  );
  const factor = statutoryProrationFactorFromDays(mtdDays);
  const statutoryWeek = isFourthStatutoryWeeklyPay(PERIOD_END_TUESDAY);

  const sss = calculateSSS(monthlySalary);
  const ph = calculatePhilHealth(monthlySalary);
  const pi = calculatePagIBIG(monthlySalary);

  const sssRegFull = Math.round((sss.regularEmployeeShare ?? 0) * 100) / 100;
  const sssWispFull = Math.round((sss.wispEmployeeShare ?? 0) * 100) / 100;
  const phFull = Math.round(ph.employeeShare * 100) / 100;
  const piFull = Math.round(pi.employeeShare * 100) / 100;

  const sssReg = statutoryWeek
    ? applyStatutoryProration(sssRegFull, factor)
    : 0;
  const sssWisp =
    statutoryWeek && sssWispFull > 0
      ? applyStatutoryProration(sssWispFull, factor)
      : 0;
  const phPr = statutoryWeek ? applyStatutoryProration(phFull, factor) : 0;
  const piPr = statutoryWeek ? applyStatutoryProration(piFull, factor) : 0;

  const contribFull =
    Math.round(
      (sss.employeeShare + ph.employeeShare + pi.employeeShare) * 100
    ) / 100;
  const contribPr = applyStatutoryProration(contribFull, factor);

  console.log("=== Proration test — March 2025 / employee", EMPLOYEE_CODE, "===");
  console.log("Employee:", emp.first_name, emp.last_name, "| id:", employeeId);
  console.log("Salary basis:", emp.salary_basis, "| rate:", perDay, "→ monthly (×26):", monthlySalary);
  console.log("Period end (Tue, local calendar):", format(PERIOD_END_TUESDAY, "yyyy-MM-dd"));
  console.log("4th statutory week (this Tue)?", statutoryWeek);
  console.log("");
  console.log("Sample scenario (seeded punches):");
  console.log("- Work days Mar 3–7, 10–13, 18, 19 (long out = OT), 24 (12 distinct dates) → gaps = absences.");
  console.log("- OT/ND on payroll do NOT add extra rows here; proration counts distinct dates with in+out only.");
  console.log("");
  console.log("MTD distinct work days (Manila, month start → period end):", mtdDays);
  console.log("Reference days:", STATUTORY_PRORATION_REFERENCE_DAYS);
  console.log("Proration factor min(1, days/26):", factor, `(${((factor * 100).toFixed(2))}%)`);
  console.log("");
  console.log("Full-month employee shares (before proration):");
  console.log("  SSS regular:", sssRegFull, "| WISP:", sssWispFull, "| PhilHealth:", phFull, "| Pag-IBIG:", piFull, "| Total SSS+PH+PI:", contribFull);
  console.log("On statutory week after proration:");
  console.log("  SSS regular:", sssReg, "| WISP:", sssWisp, "| PhilHealth:", phPr, "| Pag-IBIG:", piPr);
  console.log("  Combined contributions (prorated):", contribPr);
  console.log("");
  console.log("To remove test punches: npx tsx scripts/test-proration-march-2025-2025001.ts --cleanup");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
