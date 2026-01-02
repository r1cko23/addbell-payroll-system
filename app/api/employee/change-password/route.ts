import { NextRequest } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  errorResponse,
  validateRequiredFields,
} from "@/lib/api-utils";

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

    const supabase = createServerComponentClient({ cookies });

    // Use the secure RPC function to change password
    // This function verifies the current password and updates it securely
    const { data, error } = await supabase.rpc("change_employee_password", {
      p_employee_id: employee_id,
      p_current_password: current_password.trim(),
      p_new_password: new_password.trim(),
    });

    if (error) {
      console.error("Error changing password:", error);
      return errorResponse(
        error.message || "Failed to change password"
      );
    }

    // Check the result from the RPC function
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      return unauthorizedResponse(
        result?.error_message || "Failed to change password"
      );
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

