import { NextRequest } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import {
  badRequestResponse,
  errorResponse,
  successResponse,
  unauthorizedResponse,
  validateRequiredFields,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequiredFields(body, [
      "current_password",
      "new_password",
    ]);
    if (!validation.valid) {
      return badRequestResponse(
        "Missing required fields",
        `Missing: ${validation.missingFields.join(", ")}`
      );
    }

    const currentPassword = String(body.current_password).trim();
    const newPassword = String(body.new_password).trim();

    if (newPassword.length < 4) {
      return badRequestResponse("Password must be at least 4 characters long");
    }

    if (currentPassword === newPassword) {
      return badRequestResponse(
        "New password must be different from current password"
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return errorResponse("Server not configured", { status: 500 });
    }

    const supabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return unauthorizedResponse("Not authenticated");
    }

    const verifyClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return unauthorizedResponse("Current password is incorrect");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating auth password:", updateError);
      return errorResponse(updateError.message || "Failed to change password");
    }

    return successResponse({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error: unknown) {
    console.error("Error in auth change-password API:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error"
    );
  }
}
