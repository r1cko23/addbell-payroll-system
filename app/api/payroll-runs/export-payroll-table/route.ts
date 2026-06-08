import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { buildPayrollRunTemplateTable } from "@/lib/payroll-export/build-payroll-run-template";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const payroll_run_id = body?.payroll_run_id as string | undefined;
    if (!payroll_run_id) {
      return NextResponse.json({ error: "payroll_run_id is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end, status, companies:company_id ( name )")
      .eq("id", payroll_run_id)
      .single();
    if (runErr) throw runErr;
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    if (String(run.status) !== "finalized") {
      return NextResponse.json({ error: "Finalize the payroll run before exporting." }, { status: 400 });
    }

    const cutoffStart = String(run.cutoff_start);
    const cutoffEnd = String(run.cutoff_end);

    const [{ data: slips, error: slipsErr }, holidaysNormalized, { data: allowanceRows }] =
      await Promise.all([
      admin
        .from("payslips")
        .select(
          "id, employee_id, gross_pay, total_deductions, net_pay, adjustment_amount, allowance_amount, earnings_breakdown, deductions_breakdown, employees:employee_id ( company_id_no, first_name, middle_name, last_name, salary_basis, base_rate )"
        )
        .eq("payroll_run_id", payroll_run_id)
        .order("created_at", { ascending: true }),
      fetchHolidaysRange(admin as any, { start: cutoffStart, end: cutoffEnd }),
      admin
        .from("cutoff_allowances")
        .select(
          "employee_id, transpo_allowance, load_allowance, allowance, refund"
        )
        .eq("period_start", cutoffStart.split("T")[0]),
    ]);
    if (slipsErr) throw slipsErr;

    const cutoffAllowancesByEmployee = Object.fromEntries(
      (allowanceRows || []).map((row: any) => [row.employee_id, row])
    );

    const table = buildPayrollRunTemplateTable({
      run: {
        cutoff_start: cutoffStart,
        cutoff_end: cutoffEnd,
        company_name: String((run as any)?.companies?.name || "ADD-BELL TECHNICAL SERVICES INC."),
      },
      holidays: holidaysNormalized.map((h) => ({
        holiday_date: h.date,
        is_regular: h.type === "regular",
      })) as any[],
      slips: (slips || []) as any[],
      cutoffAllowancesByEmployee,
    });

    return NextResponse.json({ success: true, table });
  } catch (error: any) {
    console.error("Error exporting payroll table:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to export payroll table" },
      { status: 500 }
    );
  }
}

