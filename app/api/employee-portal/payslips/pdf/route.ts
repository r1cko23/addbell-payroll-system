import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePayslipPdfBytes } from "@/utils/payslip-pdf";
import { resolveEmployeePosition } from "@/lib/payslip-display";

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
    const payslipId = req.nextUrl.searchParams.get("payslip_id");
    const employeeId = req.nextUrl.searchParams.get("employee_id");

    if (!payslipId || !employeeId) {
      return NextResponse.json(
        { error: "payslip_id and employee_id are required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: payslip, error } = await admin
      .from("payslips")
      .select("*")
      .eq("id", payslipId)
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (error) throw error;
    if (!payslip) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    const { data: emp } = await admin
      .from("employees")
      .select(
        "company_id_no, employee_code, full_name, position, employment_type, job_level, salary_basis, base_rate, hire_date, positions:position_id ( name )"
      )
      .eq("id", employeeId)
      .maybeSingle();

    const pdfBytes = generatePayslipPdfBytes({
      payslip: {
        ...payslip,
        payslip_number: payslip.payslip_number || payslip.id,
        period_start: String(payslip.period_start).split("T")[0],
        period_end: String(payslip.period_end).split("T")[0],
        gross_pay: Number(payslip.gross_pay || 0),
        net_pay: Number(payslip.net_pay || 0),
        total_deductions: Number(payslip.total_deductions || 0),
        adjustment_amount: Number(payslip.adjustment_amount || 0),
        allowance_amount: Number(payslip.allowance_amount || 0),
        sss_amount: Number(payslip.sss_amount || 0),
        philhealth_amount: Number(payslip.philhealth_amount || 0),
        pagibig_amount: Number(payslip.pagibig_amount || 0),
        withholding_tax: Number(payslip.withholding_tax || 0),
      },
      profile: {
        employee_id: emp?.company_id_no || emp?.employee_code || employeeId,
        full_name: emp?.full_name || "Employee",
        position: emp ? resolveEmployeePosition(emp as any) : null,
        employment_type: emp?.employment_type ?? null,
        job_level: emp?.job_level ?? null,
        salary_basis: emp?.salary_basis ?? null,
        base_rate: emp?.base_rate ?? null,
        hire_date: emp?.hire_date ?? null,
      },
    });

    const filename = `payslip-${String(payslip.period_end).split("T")[0]}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error("employee payslip pdf error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
