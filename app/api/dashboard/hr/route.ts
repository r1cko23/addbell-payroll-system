import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { CACHE_TTL, cachedJson } from "@/lib/cache";
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

  // Keep userId — HR payload is scoped to the viewer's managed groups.
  const { data, cache } = await cachedJson(
    ["dashboard", "hr", auth.userId],
    () => loadHrDashboardPayload(supabase, auth.userId, auth.role),
    CACHE_TTL.dashboard
  );

  return NextResponse.json(data, { headers: { "X-Cache": cache } });
}
