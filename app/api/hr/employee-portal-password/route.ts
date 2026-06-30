import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyEmployeeRecordEditAccess } from "@/lib/api-helpers";
export { dynamic } from "@/lib/api-route-segment";


function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyEmployeeRecordEditAccess();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      employee_id?: string;
      new_password?: string;
      use_default_password?: boolean;
    };

    const employeeId = body.employee_id?.trim();
    const useDefaultPassword = body.use_default_password === true;
    const customPassword = body.new_password?.trim() || "";

    if (!employeeId) {
      return NextResponse.json(
        { error: "Missing employee_id" },
        { status: 400 }
      );
    }

    if (!useDefaultPassword && customPassword.length < 4) {
      return NextResponse.json(
        { error: "Custom password must be at least 4 characters long" },
        { status: 400 }
      );
    }

    const admin = adminClient();
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, company_id_no, first_name, last_name")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error(employeeError);
      return NextResponse.json(
        { error: "Failed to load employee" },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const nextPassword = useDefaultPassword
      ? String(employee.company_id_no || "").trim()
      : customPassword;

    if (!nextPassword) {
      return NextResponse.json(
        { error: "Employee has no company ID number to use as a default password" },
        { status: 400 }
      );
    }

    const { error: updateError } = await admin
      .from("employees")
      .update({
        portal_password: nextPassword,
      } as never)
      .eq("id", employeeId);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json(
        { error: "Failed to reset employee portal password" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      employee_name: [employee.first_name, employee.last_name].filter(Boolean).join(" "),
      temporary_password: nextPassword,
      reset_mode: useDefaultPassword ? "company_id_no" : "custom",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected reset error",
      },
      { status: 500 }
    );
  }
}
