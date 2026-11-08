import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { verifyAdminAccess, clearUserRoleCache } from "@/lib/api-helpers";
import { ASSIGNABLE_STAFF_ROLES, isAssignableStaffRole } from "@/lib/user-roles";
export { dynamic } from "@/lib/api-route-segment";


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    // Verify service role key is configured
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: "Server not configured",
          details:
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable",
        },
        { status: 500 }
      );
    }

    // Verify admin access using optimized helper
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const { email, full_name, password, role } = await req.json();

    // Validate input - check for empty strings after trim
    const trimmedEmail = email?.trim();
    const trimmedFullName = full_name?.trim();
    const trimmedPassword = password?.trim();

    if (!trimmedEmail || !trimmedFullName || !trimmedPassword || !role) {
      const missingFields = [];
      if (!trimmedEmail) missingFields.push("email");
      if (!trimmedFullName) missingFields.push("full name");
      if (!trimmedPassword) missingFields.push("password");
      if (!role) missingFields.push("role");

      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate role
    if (!isAssignableStaffRole(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${ASSIGNABLE_STAFF_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate password strength
    if (trimmedPassword.length < 8) {
      return NextResponse.json(
        {
          error: `Password must be at least 8 characters long (currently ${trimmedPassword.length})`,
        },
        { status: 400 }
      );
    }

    // Create admin client with service role key
    // Service role key bypasses RLS automatically - no session should be attached
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail.toLowerCase(),
        password: trimmedPassword,
        email_confirm: true, // Auto-confirm the user
        // Role is set on the profile below, never from metadata.
        user_metadata: {
          full_name: trimmedFullName,
        },
      });

    if (createAuthError || !authData.user) {
      console.error("Error creating auth user:", createAuthError);
      return NextResponse.json(
        {
          error: "Failed to create user in authentication system",
          details: createAuthError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    console.log("Auth user created successfully:", {
      userId: authData.user.id,
    });

    // Step 2: Make sure the profile has the role and name (the trigger may have run first or not at all).
    const { data: userData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        email: trimmedEmail.toLowerCase(),
        full_name: trimmedFullName,
        role,
        is_active: true,
      })
      .select("id, email, full_name, role")
      .single();

    if (profileError || !userData) {
      console.error("Error saving profile:", profileError);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error("Error cleaning up auth user:", cleanupError);
      }
      return NextResponse.json(
        {
          error: "Failed to create user record",
          details: profileError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    clearUserRoleCache(userData.id);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
