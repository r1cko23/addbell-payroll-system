import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enrichPayslipAttendanceFromClock } from "@/lib/enrich-payslip-attendance";
export { dynamic } from "@/lib/api-route-segment";


function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("payslips")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: empRow } = await admin
      .from("employees")
      .select("salary_basis, base_rate")
      .eq("id", employeeId)
      .maybeSingle();

    const normalized = await Promise.all(
      (data || []).map(async (row: any) => {
        const periodStart = String(
          row.period_start || row.cutoff_start || row.created_at
        ).split("T")[0];
        const periodEnd = String(
          row.period_end || row.cutoff_end || row.created_at
        ).split("T")[0];

        let earnings_breakdown = row.earnings_breakdown || {};
        const savedGross = Number(row.gross_pay || 0);
        let displayGross = savedGross;
        try {
          const enriched = await enrichPayslipAttendanceFromClock(admin, {
            employeeId,
            periodStart,
            periodEnd,
            earningsBreakdown: row.earnings_breakdown,
            salaryBasis: empRow?.salary_basis,
            baseRate: empRow?.base_rate,
          });
          earnings_breakdown = {
            attendance_data: enriched.attendance_data,
            payroll_result: enriched.payroll_result,
          };
          displayGross = Math.max(savedGross, enriched.gross_pay);
        } catch {
          // Keep stored breakdown if enrichment fails
        }

        return {
          ...row,
          payslip_number: row.payslip_number || row.payslip_no || row.id,
          period_start: periodStart,
          period_end: periodEnd,
          period_type: row.period_type || "weekly",
          status: row.status || "draft",
          gross_pay: displayGross,
          net_pay: Number(row.net_pay || 0),
          sss_amount: Number(row.sss_amount || 0),
          philhealth_amount: Number(row.philhealth_amount || 0),
          pagibig_amount: Number(row.pagibig_amount || 0),
          withholding_tax: Number(row.withholding_tax || 0),
          total_deductions: Number(row.total_deductions || 0),
          adjustment_amount: Number(row.adjustment_amount || 0),
          allowance_amount: Number(row.allowance_amount || 0),
          earnings_breakdown,
          deductions_breakdown: row.deductions_breakdown || {},
        };
      })
    );

    return NextResponse.json({ payslips: normalized });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

