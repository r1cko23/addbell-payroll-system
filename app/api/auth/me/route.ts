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

    // Get full user data (role is already cached, but we need other fields)
    type UserRow = Database["public"]["Tables"]["users"]["Row"];
    type UserSelect = Pick<UserRow, "id" | "email" | "full_name" | "role">;

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", authUser.id)
      .eq("is_active", true)
      .single<UserSelect>();

    if (userError || !userData) {
      return unauthorizedResponse("User not found");
    }

    // Cache user data for 30 seconds to reduce DB hits
    return successResponse(
      {
        user: {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
        },
      },
      { cache: 30, staleWhileRevalidate: 60 }
    );
  } catch (error) {
    return errorResponse("Invalid session", { status: 401 });
  }
}