import { NextRequest } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  errorResponse,
  validateRequiredFields,
} from "@/lib/api-utils";
import { clearUserRoleCache } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const validation = validateRequiredFields(body, ["email", "password"]);
    if (!validation.valid) {
      return badRequestResponse(
        "Missing required fields",
        `Missing: ${validation.missingFields.join(", ")}`
      );
    }

    const { email, password } = body;

    // Create Supabase client that handles cookies automatically
    const supabase = createServerComponentClient<Database>({ cookies });

    // Authenticate using Supabase Auth (server-side, no CORS issues)
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

    if (authError || !authData.user) {
      console.error("Authentication error:", authError);
      return unauthorizedResponse(authError?.message || "Invalid credentials");
    }

    // Get user role from public.profiles table
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", authData.user.id)
      .eq("is_active", true)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user data:", userError);
      return unauthorizedResponse("User not found or inactive");
    }

    // Clear cache for this user to ensure fresh data on next request
    clearUserRoleCache(userData.id);

    // Supabase Auth session is now set in cookies automatically
    return successResponse(
      {
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
        },
      },
      { cache: 0 } // No cache for login responses
    );
  } catch (error: any) {
    console.error("Login error:", error);
    return errorResponse(error.message || "Internal server error");
  }
}