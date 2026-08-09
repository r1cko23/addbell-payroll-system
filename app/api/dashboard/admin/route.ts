import { NextResponse } from "next/server";
import { CACHE_TTL, cachedJson } from "@/lib/cache";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { loadAdminDashboardPayload } from "@/lib/fetch-admin-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminAccess();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shared across admins — payload is not user-specific.
  const { data, cache } = await cachedJson(
    ["dashboard", "admin"],
    loadAdminDashboardPayload,
    CACHE_TTL.dashboard
  );

  return NextResponse.json(data, { headers: { "X-Cache": cache } });
}
