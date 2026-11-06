import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  clearPortalSessionCookie,
  getPortalSession,
  isDefaultPortalPassword,
  setPortalSessionCookie,
} from "@/lib/portal-session";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";

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

    // Passwords are checked inside the database (bcrypt, with plain-text fallback until
    // every stored password is hashed). Identifier order: employee_id, company_id_no,
    // employee_code (ZKTeco pin).
    const { data: matchedId, error: matchError } = await admin.rpc("portal_login_employee_id", {
      p_login_id: loginId,
      p_password: password,
    } as never);
    if (matchError) throw matchError;

    let employee: {
      id: string;
      employee_id: string;
      full_name: string;
      company_id_no: string | null;
      employee_code: string | null;
    } | null = null;
    if (matchedId) {
      const { data, error } = await admin
        .from("employees")
        .select("id, employee_id, full_name, company_id_no, employee_code")
        .eq("id", matchedId as unknown as string)
        .maybeSingle();
      if (error) throw error;
      employee = data;
    }

    if (!employee) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // HR's default password is the employee's own ID; make them pick a real one first.
    const mustChangePassword = isDefaultPortalPassword(password, [
      employee.employee_id,
      employee.company_id_no,
      employee.employee_code,
    ]);

    const res = NextResponse.json({
      success: true,
      must_change_password: mustChangePassword,
      employee_data: {
        id: employee.id,
        employee_id: employee.employee_id,
        full_name: employee.full_name,
      },
    });
    setPortalSessionCookie(res, employee.id, { mustChangePassword });
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Who is signed into the portal (the layout checks this on load). */
export async function GET() {
  const session = getPortalSession();
  if (!session) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    employee_id: session.employeeId,
    must_change_password: session.mustChangePassword,
  });
}

/** Portal sign-out. */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  clearPortalSessionCookie(res);
  return res;
}
