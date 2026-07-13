import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { enrichPayslipAttendanceFromClock } from "@/lib/enrich-payslip-attendance";
import {
  mapPayslipDeductionsForPrint,
  resolveAllowanceForPayslipDisplay,
  resolveAdjustmentForPayslipDisplay,
  resolveEmployeePosition,
} from "@/lib/payslip-display";

export { dynamic } from "@/lib/api-route-segment";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** HR payroll run: enriched attendance + rates for PayslipPrint (matches Payslips page). */
export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payslipId = req.nextUrl.searchParams.get("payslip_id");
    if (!payslipId) {
      return NextResponse.json({ error: "payslip_id is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: ps, error } = await admin
      .from("payslips")
      .select(
        "id, employee_id, period_start, period_end, gross_pay, net_pay, total_deductions, adjustment_amount, adjustment_reason, allowance_amount, earnings_breakdown, deductions_breakdown, employees:employee_id ( first_name, last_name, company_id_no, salary_basis, base_rate, position, employment_type, job_level, positions:position_id ( name ) )"
      )
      .eq("id", payslipId)
      .single();

    if (error || !ps) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    const emp = (ps as any).employees || {};
    const periodStart = String(ps.period_start);
    const periodEnd = String(ps.period_end);

    const enriched = await enrichPayslipAttendanceFromClock(admin, {
      employeeId: ps.employee_id,
      periodStart,
      periodEnd,
      earningsBreakdown: ps.earnings_breakdown,
      salaryBasis: emp.salary_basis,
      baseRate: emp.base_rate,
    });

    const deductions = mapPayslipDeductionsForPrint(ps as any);
    const { amount: allowanceAmount, lines: allowanceLines } =
      resolveAllowanceForPayslipDisplay(ps as any);
    const { amount: adjustmentAmount, reason: adjustmentReason } =
      resolveAdjustmentForPayslipDisplay(ps as any);
    const grossPay = Number(ps.gross_pay ?? enriched.gross_pay);
    const displayGross =
      Math.abs(grossPay - enriched.gross_pay) > 0.01
        ? Math.max(grossPay, enriched.gross_pay)
        : enriched.gross_pay;

    return NextResponse.json({
      employee: {
        employee_id: emp.company_id_no || ps.employee_id,
        full_name:
          [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim() ||
          "Employee",
        rate_per_day:
          String(emp.salary_basis || "").toLowerCase() === "daily"
            ? Number(emp.base_rate || 0)
            : Number(emp.base_rate || 0) / 26,
        rate_per_hour: enriched.rate_per_hour,
        position: resolveEmployeePosition(emp),
        employee_type: emp.employment_type || null,
        job_level: emp.job_level || null,
      },
      period_start: periodStart,
      period_end: periodEnd,
      attendance: {
        attendance_data: enriched.attendance_data,
        gross_pay: displayGross,
      },
      gross_pay: displayGross,
      net_pay: Number(ps.net_pay ?? 0),
      adjustment_amount: adjustmentAmount,
      adjustment_reason: adjustmentReason,
      allowance_amount: allowanceAmount,
      allowance_lines: allowanceLines,
      deductions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
