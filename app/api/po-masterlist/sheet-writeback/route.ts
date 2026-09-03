import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { getCurrentUserRole } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/fund-request-api";
import { flushPoMasterlistSheetWritebackQueue } from "@/lib/po-masterlist-sheet-writeback";
import { normalizeUserRole } from "@/lib/user-roles";

export { dynamic } from "@/lib/api-route-segment";

/**
 * Drain the async P.O. masterlist → Google Sheets writeback queue.
 * Admin-only. Does not block ordinary job saves (those call schedulePoMasterlistSheetWriteback).
 */
export async function POST() {
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
    const result = await flushPoMasterlistSheetWritebackQueue({ admin });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to flush sheet writeback queue",
      },
      { status: 500 }
    );
  }
}
