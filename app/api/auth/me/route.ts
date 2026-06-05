import { NextRequest } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/api-utils";
import { getCurrentUserRole } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies });

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return unauthorizedResponse("Not authenticated");
    }

    // Get user role using optimized helper (with caching)
    const role = await getCurrentUserRole();
    if (!role) {
      return unauthorizedResponse("User not found");
    }

    // Get full user data from profiles table (role is already cached, but we need other fields)
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, avatar_url, is_active, can_access_salary, can_manage_clock_access"
      )
      .eq("id", authUser.id)
      .eq("is_active", true)
      .single();

    if (profileError || !profileData) {
      return unauthorizedResponse("User not found");
    }

    // Cache user data for 30 seconds to reduce DB hits
    return successResponse(
      {
        user: {
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          role: profileData.role,
          profile_picture_url: profileData.avatar_url,
          can_access_salary: profileData.can_access_salary ?? false,
          can_manage_clock_access: profileData.can_manage_clock_access ?? false,
        },
      },
      { cache: 30, staleWhileRevalidate: 60 }
    );
  } catch (error) {
    return errorResponse("Invalid session", { status: 401 });
  }
}