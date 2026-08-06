import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { cachedJson } from "@/lib/cache";
import { verifyHrDashboardAccess } from "@/lib/api-helpers";
import { loadHrDashboardPayload } from "@/lib/fetch-hr-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyHrDashboardAccess();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerComponentClient<Database>({ cookies });

  const { data, cache } = await cachedJson(
    ["dashboard", "hr", auth.userId],
    () => loadHrDashboardPayload(supabase, auth.userId, auth.role),
    60
  );

  return NextResponse.json(data, { headers: { "X-Cache": cache } });
}
