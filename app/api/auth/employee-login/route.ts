import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      employee_id?: string;
      password?: string;
    };

    // "employee_id" in the request is the login identifier.
    // For historical reasons and after migrations, that identifier may be:
    // - employees.employee_id (e.g. 2025001)
    // - employees.company_id_no (e.g. AX-10001)
    // - employees.employee_code (digits only; ZKTeco pin)
    const loginId = body?.employee_id?.trim();
    const password = body?.password;

    if (!loginId || !password) {
      return NextResponse.json(
        { success: false, error: "Missing credentials" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Validate portal credentials server-side to avoid RLS/login RPC issues.
    const selectBase = () =>
      admin
        .from("employees")
        .select("id, employee_id, full_name");

    const tryFind = async (column: "employee_id" | "company_id_no" | "employee_code") => {
      const { data, error } = await selectBase()
        .eq("is_active", true)
        .eq("portal_password", password)
        .eq(column, loginId)
        .maybeSingle();

      if (error) {
        // Some columns may not exist in older schema versions; treat missing-column
        // as "not found" rather than failing login completely.
        const msg = error.message || "";
        const columnMissing = msg.includes("column") && (msg.includes("does not exist") || msg.includes("not exist"));
        if (columnMissing) return { employee: null as any, error: null as any };
        throw error;
      }
      return { employee: data, error: null as any };
    };

    let employee: { id: string; employee_id: string; full_name: string } | null = null;
    // Try the three most likely identifiers in order.
    employee = (await tryFind("employee_id")).employee || null;
    if (!employee) employee = (await tryFind("company_id_no")).employee || null;
    if (!employee) employee = (await tryFind("employee_code")).employee || null;

    if (!employee) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      employee_data: {
        id: employee.id,
        employee_id: employee.employee_id,
        full_name: employee.full_name,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

