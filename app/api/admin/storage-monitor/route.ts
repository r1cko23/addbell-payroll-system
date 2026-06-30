import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { getCurrentUserRole } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/fund-request-api";
import { getPlatformStorageMonitorSnapshot } from "@/lib/platform-storage-monitor";
import { getPlatformApiMonitorSnapshot } from "@/lib/platform-api-monitor";
import { normalizeUserRole } from "@/lib/user-roles";

export async function GET() {
  try {
    const cookieSupabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user },
    } = await cookieSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getCurrentUserRole();
    if (normalizeUserRole(role) !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getAdminClient();
    const [storage, platform] = await Promise.all([
      getPlatformStorageMonitorSnapshot(admin),
      Promise.resolve(getPlatformApiMonitorSnapshot()),
    ]);

    return NextResponse.json({
      ...storage,
      ...platform,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load storage monitor" },
      { status: 500 }
    );
  }
}
