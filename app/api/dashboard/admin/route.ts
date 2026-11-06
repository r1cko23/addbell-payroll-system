import { NextResponse } from "next/server";
import { CACHE_TTL, cachedJson } from "@/lib/cache";
import { getCurrentUserRole } from "@/lib/api-helpers";
import { normalizeUserRole } from "@/lib/user-roles";
import { loadAdminDashboardPayload } from "@/lib/fetch-admin-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // The executive dashboard is the landing page for both admin and upper management.
  const role = normalizeUserRole(await getCurrentUserRole());
  if (role !== "admin" && role !== "upper_management") {
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
