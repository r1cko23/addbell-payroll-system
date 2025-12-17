import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function PATCH(req: NextRequest) {
  try {
    // Get current user session to verify admin access
    const supabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user: currentUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify current user is admin
    const { data: currentUserData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .eq("is_active", true)
      .single();

    if (userError || !currentUserData || currentUserData.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const { userId, is_active } = await req.json();

    // Validate input
    if (!userId || typeof is_active !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: userId, is_active" },
        { status: 400 }
      );
    }

    // Prevent self-deactivation
    if (userId === currentUser.id && !is_active) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    // Use service role client for the actual update to bypass RLS
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Update user status using service role
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ is_active })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user status:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update user status",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating user status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
