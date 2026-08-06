import { NextResponse } from "next/server";
import { invalidateAppCache } from "@/lib/cache";
import { isRedisEnabled } from "@/lib/redis";
import { getCurrentUserRole } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const role = await getCurrentUserRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await invalidateAppCache();
  return NextResponse.json({
    success: true,
    redis: isRedisEnabled(),
    invalidated: ok,
  });
}
