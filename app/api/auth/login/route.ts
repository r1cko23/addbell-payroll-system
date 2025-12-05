import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        {
          error: "Authentication failed",
          details: authError?.message || "Invalid credentials",
          code: authError?.status || "UNKNOWN",
        },
        { status: 401 }
      );
    }

    // Get user role from public.users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", authData.user.id)
      .eq("is_active", true)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user data:", userError);
      return NextResponse.json(
        {
          error: "User not found or inactive",
          details: userError?.message || "User data not available",
        },
        { status: 401 }
      );
    }

    // Supabase Auth session is now set in cookies automatically
    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
