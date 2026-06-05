import { NextRequest } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/api-utils";
import { getDefaultLandingRoute } from "@/lib/default-landing-route";
import type { UserPermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies });

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return unauthorizedResponse("Not authenticated");
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role, permissions")
      .eq("id", authUser.id)
      .eq("is_active", true)
      .single();

    if (profileError || !profileData) {
      return unauthorizedResponse("User not found");
    }

    const route = getDefaultLandingRoute(
      profileData.role,
      profileData.permissions as Partial<UserPermissions> | null
    );

    return successResponse({ route });
  } catch (error) {
    return errorResponse("Failed to resolve landing route", { status: 500 });
  }
}
