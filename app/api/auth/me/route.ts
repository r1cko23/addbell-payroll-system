import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies });

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user role from public.users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", authUser.id)
      .eq("is_active", true)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
