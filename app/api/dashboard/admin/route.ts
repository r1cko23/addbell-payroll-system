import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/cache";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { loadAdminDashboardPayload } from "@/lib/fetch-admin-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminAccess();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, cache } = await cachedJson(
    ["dashboard", "admin", auth.userId],
    loadAdminDashboardPayload,
    60
  );

  return NextResponse.json(data, { headers: { "X-Cache": cache } });
}
