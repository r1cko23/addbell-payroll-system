import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import type { FundRequestRow } from "@/types/fund-request";
import { getCurrentUserRole } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/fund-request-api";
import {
  buildFundRequestMoveToCurrentCutoffUpdates,
  canMoveFundRequestToCurrentCutoff,
} from "@/lib/fund-request-cutoff-move";
import { normalizeUserRole } from "@/lib/user-roles";

export { dynamic } from "@/lib/api-route-segment";

type RouteContext = {
  params: { id: string };
};

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const requestId = params.id?.trim();
    if (!requestId) {
      return NextResponse.json({ error: "Request id is required" }, { status: 400 });
    }

    const cookieSupabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user: authUser },
    } = await cookieSupabase.auth.getUser();

    if (!authUser?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const role = await getCurrentUserRole();
    if (normalizeUserRole(role) !== "upper_management") {
      return NextResponse.json(
        { error: "Only upper management can move requests between cutoffs." },
        { status: 403 }
      );
    }

    const admin = getAdminClient();
    const { data: existing, error: loadError } = await admin
      .from("fund_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const request = existing as FundRequestRow;
    if (!canMoveFundRequestToCurrentCutoff(request, role)) {
      return NextResponse.json(
        {
          error:
            "This request is not in the succeeding cutoff or cannot be moved to the current processing batch.",
        },
        { status: 400 }
      );
    }

    const moveResult = buildFundRequestMoveToCurrentCutoffUpdates(request, authUser.id);
    if (!moveResult) {
      return NextResponse.json(
        { error: "Unable to move this request to the current cutoff." },
        { status: 400 }
      );
    }

    const { updates, adjustment } = moveResult;
    const { data: updated, error: updateError } = await admin
      .from("fund_requests")
      .update(updates as never)
      .eq("id", requestId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      user_id: authUser.id,
      action: "move_to_current_cutoff",
      table_name: "fund_requests",
      record_id: requestId,
      old_data: {
        created_at: request.created_at,
        cutoff_start_ymd: adjustment.from_cutoff_start_ymd,
      },
      new_data: {
        created_at: adjustment.to_created_at,
        cutoff_start_ymd: adjustment.to_cutoff_start_ymd,
        adjustment,
      },
    });

    if (auditError) {
      console.error("Failed to write fund request cutoff move audit log", auditError);
    }

    return NextResponse.json({
      request: updated,
      adjustment,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
