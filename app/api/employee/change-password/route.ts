import { NextRequest, NextResponse } from "next/server";
import {
  isDefaultPortalPassword,
  requirePortalEmployee,
  setPortalSessionCookie,
} from "@/lib/portal-session";
import { createClient } from "@supabase/supabase-js";
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  errorResponse,
  validateRequiredFields,
} from "@/lib/api-utils";

export { dynamic } from "@/lib/api-route-segment";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const validation = validateRequiredFields(body, [
      "employee_id",
      "current_password",
      "new_password",
    ]);
    if (!validation.valid) {
      return badRequestResponse(
        "Missing required fields",
        `Missing: ${validation.missingFields.join(", ")}`
      );
    }

    const { employee_id, current_password, new_password } = body;

    // Only the signed-in employee may change their own password; allowed while a
    // default-password session is waiting for exactly this change.
    const portal = requirePortalEmployee(employee_id, { allowPendingPasswordChange: true });
    if (portal instanceof NextResponse) return portal;

    // Validate password length
    if (new_password.trim().length < 4) {
      return badRequestResponse(
        "Password must be at least 4 characters long"
      );
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return errorResponse("Server not configured", { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: employeeRow, error: employeeError } = await supabase
      .from("employees")
      .select("id, employee_id, company_id_no, employee_code")
      .eq("id", employee_id)
      .maybeSingle();

    if (employeeError) {
      console.error("Error loading employee for password change:", employeeError);
      return errorResponse(employeeError.message || "Failed to verify employee password");
    }

    if (!employeeRow) {
      return unauthorizedResponse("Employee not found");
    }

    const { data: currentMatches, error: verifyError } = await supabase.rpc(
      "portal_verify_password",
      { p_employee_id: employee_id, p_password: current_password.trim() } as never
    );
    if (verifyError) {
      console.error("Error verifying employee password:", verifyError);
      return errorResponse("Failed to verify employee password");
    }
    if (!currentMatches) {
      return unauthorizedResponse("Current password is incorrect");
    }

    const ids = employeeRow as {
      employee_id?: string | null;
      company_id_no?: string | null;
      employee_code?: string | null;
    };
    if (isDefaultPortalPassword(new_password, [ids.employee_id, ids.company_id_no, ids.employee_code])) {
      return badRequestResponse("Choose a password that is not your employee or company ID");
    }

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        portal_password: new_password.trim(),
      } as never)
      .eq("id", employee_id);

    if (updateError) {
      console.error("Error updating employee portal password:", updateError);
      return errorResponse(updateError.message || "Failed to change password");
    }

    const res = successResponse({
      success: true,
      message: "Password updated successfully",
    });
    // Fresh session without the "must change password" flag.
    setPortalSessionCookie(res, portal.employeeId);
    return res;
  } catch (error: any) {
    console.error("Error in change-password API:", error);
    return errorResponse(error.message || "Internal server error");
  }
}
