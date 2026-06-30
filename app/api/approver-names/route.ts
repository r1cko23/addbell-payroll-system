import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { loadApproverNameMap } from "@/lib/load-approver-names";
export { dynamic } from "@/lib/api-route-segment";


const APPROVAL_ROLES = new Set([
  "hr",
  "admin",
  "upper_management",
  "operations_manager",
  "project_manager",
  "purchasing_officer",
  "approver",
  "viewer",
]);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.role || !APPROVAL_ROLES.has(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];

    const admin = getAdminClient();
    const names = await loadApproverNameMap(admin, ids);

    return NextResponse.json({ names });
  } catch (error) {
    console.error("approver-names error:", error);
    return NextResponse.json(
      { error: "Failed to resolve approver names" },
      { status: 500 }
    );
  }
}
