import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { verifyAdminAccess, clearUserRoleCache } from "@/lib/api-helpers";

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
    const { email, full_name, password, role, ot_groups } = await req.json();

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
    const validRoles = ["admin", "hr", "approver", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
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

    // Verify we're using service role (should not have a user session)
    const {
      data: { user: adminUser },
    } = await supabaseAdmin.auth.getUser();
    console.log("Admin client user check:", {
      hasUser: !!adminUser,
      userId: adminUser?.id,
      isServiceRole: !adminUser, // Service role should not have a user session
    });

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail.toLowerCase(),
        password: trimmedPassword,
        email_confirm: true, // Auto-confirm the user
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

    // Step 2: Insert user into users table
    type UserRow = Database["public"]["Tables"]["users"]["Row"];
    const { data: userData, error: userInsertError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authData.user.id,
        email: trimmedEmail.toLowerCase(),
        full_name: trimmedFullName,
        role: role,
        is_active: true,
      })
      .select()
      .single<UserRow>();

    if (userInsertError) {
      // If user table insert fails, try to clean up auth user
      console.error("Error inserting user into users table:", userInsertError);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error("Error cleaning up auth user:", cleanupError);
      }

      return NextResponse.json(
        {
          error: "Failed to create user record",
          details: userInsertError.message,
        },
        { status: 500 }
      );
    }

    // Step 3: Assign to OT groups if OT Approver/Viewer
    if ((role === "approver" || role === "viewer") && ot_groups && Array.isArray(ot_groups) && ot_groups.length > 0) {
      const updateField = role === "approver" ? "approver_id" : "viewer_id";

      for (const groupId of ot_groups) {
        const { error: groupError } = await supabaseAdmin
          .from("overtime_groups")
          .update({ [updateField]: userData.id })
          .eq("id", groupId);

        if (groupError) {
          console.error(`Error assigning user to group ${groupId}:`, groupError);
          // Continue with other groups even if one fails
        }
      }
    }

    // Clear cache for new user
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
