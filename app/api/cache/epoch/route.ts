import { NextResponse } from "next/server";
import { getCacheEpoch } from "@/lib/cache";
import { isRedisEnabled } from "@/lib/redis";
import { getCurrentUserRole } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight freshness probe for mid-session cache.
 * Clients compare this to their last-known epoch; a bump means another
 * user/mutation invalidated shared cache — bust session and refetch.
 */
export async function GET() {
  const role = await getCurrentUserRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const epoch = await getCacheEpoch();
  return NextResponse.json({
    epoch,
    redis: isRedisEnabled(),
  });
}
