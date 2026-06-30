/**
 * Employee portal: read limited employees row fields (service role).
 * Client has no Supabase JWT; RLS blocks anon SELECT on employees.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveEmployeePosition } from "@/lib/payslip-display";
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
      .from("employees")
      .select(
        "company_id_no, employee_code, full_name, first_name, last_name, middle_name, address, date_of_birth, tin, sss_number, philhealth_number, pagibig_number, is_active, created_at, position, employment_type, job_level, shift_start_time, shift_end_time, requires_ot_punch, salary_basis, base_rate, hire_date, positions:position_id ( name )"
      )
      .eq("id", employeeId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      company_id_no: data?.company_id_no ?? null,
      employee_code: data?.employee_code ?? null,
      full_name: data?.full_name ?? null,
      first_name: data?.first_name ?? null,
      last_name: data?.last_name ?? null,
      middle_name: data?.middle_name ?? null,
      address: data?.address ?? null,
      date_of_birth: data?.date_of_birth ?? null,
      tin: data?.tin ?? null,
      sss_number: data?.sss_number ?? null,
      philhealth_number: data?.philhealth_number ?? null,
      pagibig_number: data?.pagibig_number ?? null,
      is_active: data?.is_active ?? null,
      created_at: data?.created_at ?? null,
      position: data ? resolveEmployeePosition(data as any) : null,
      employment_type: data?.employment_type ?? null,
      job_level: data?.job_level ?? null,
      shift_start_time: data?.shift_start_time ?? null,
      shift_end_time: data?.shift_end_time ?? null,
      requires_ot_punch: data?.requires_ot_punch ?? false,
      salary_basis: data?.salary_basis ?? null,
      base_rate: data?.base_rate != null ? Number(data.base_rate) : null,
      hire_date: data?.hire_date ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
