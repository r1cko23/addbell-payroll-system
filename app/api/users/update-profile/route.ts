import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminAccess, clearUserRoleCache } from "@/lib/api-helpers";
export { dynamic } from "@/lib/api-route-segment";


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ProfilePatch = {
  userId?: string;
  full_name?: string;
  role?: string;
  can_access_salary?: boolean;
  can_manage_clock_access?: boolean;
};

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as ProfilePatch;
    const { userId, full_name, role, can_access_salary, can_manage_clock_access } =
      body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (typeof full_name === "string" && full_name.trim()) {
      updates.full_name = full_name.trim();
    }
    if (typeof role === "string" && role.trim()) {
      updates.role = role.trim();
    }
    if (typeof can_access_salary === "boolean") {
      updates.can_access_salary = can_access_salary;
    }
    if (typeof can_manage_clock_access === "boolean") {
      updates.can_manage_clock_access = can_manage_clock_access;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select(
        "id, email, full_name, role, is_active, can_access_salary, can_manage_clock_access, permissions"
      )
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update profile",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    clearUserRoleCache(userId);

    return NextResponse.json({ success: true, user: updatedProfile }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
