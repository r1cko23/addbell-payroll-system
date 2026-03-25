import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const normalized = (data || []).map((row: any) => ({
      ...row,
      payslip_number: row.payslip_number || row.payslip_no || row.id,
      period_start: row.period_start || row.cutoff_start || row.created_at,
      period_end: row.period_end || row.cutoff_end || row.created_at,
      period_type: row.period_type || "weekly",
      status: row.status || "draft",
      gross_pay: Number(row.gross_pay || 0),
      net_pay: Number(row.net_pay || 0),
      sss_amount: Number(row.sss_amount || 0),
      philhealth_amount: Number(row.philhealth_amount || 0),
      pagibig_amount: Number(row.pagibig_amount || 0),
      withholding_tax: Number(row.withholding_tax || 0),
      total_deductions: Number(row.total_deductions || 0),
      adjustment_amount: Number(row.adjustment_amount || 0),
      allowance_amount: Number(row.allowance_amount || 0),
      earnings_breakdown: row.earnings_breakdown || {},
      deductions_breakdown: row.deductions_breakdown || {},
    }));

    return NextResponse.json({ payslips: normalized });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

