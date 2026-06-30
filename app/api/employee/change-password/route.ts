import { NextRequest } from "next/server";
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
      .select("id, portal_password")
      .eq("id", employee_id)
      .maybeSingle();

    if (employeeError) {
      console.error("Error loading employee for password change:", employeeError);
      return errorResponse(employeeError.message || "Failed to verify employee password");
    }

    if (!employeeRow) {
      return unauthorizedResponse("Employee not found");
    }

    if ((employeeRow as { portal_password?: string | null }).portal_password !== current_password.trim()) {
      return unauthorizedResponse("Current password is incorrect");
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

    return successResponse({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error: any) {
    console.error("Error in change-password API:", error);
    return errorResponse(error.message || "Internal server error");
  }
}
