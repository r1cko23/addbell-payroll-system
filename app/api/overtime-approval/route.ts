import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { CACHE_TTL, cachedJson } from "@/lib/cache";
import { verifyDashboardUser } from "@/lib/api-helpers";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";

export { dynamic } from "@/lib/api-route-segment";

/**
 * Week-scoped OT approval list for dashboard approvers.
 * Client still applies role visibility filters for Approve/Reject UI.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyDashboardUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = req.nextUrl.searchParams.get("week_start");
  const weekEnd = req.nextUrl.searchParams.get("week_end");
  const status = req.nextUrl.searchParams.get("status") || "all";
  const employeeId = req.nextUrl.searchParams.get("employee_id") || "all";

  if (!weekStart || !weekEnd) {
    return NextResponse.json(
      { error: "week_start and week_end are required" },
      { status: 400 }
    );
  }

  const supabase = createServerComponentClient<Database>({ cookies });

  // Shared key (not per-user): payload is identical; role filtering is client-side.
  const { data, cache } = await cachedJson(
    ["ot-approval", weekStart, weekEnd, status, employeeId],
    async () => {
      let query = supabase
        .from("overtime_requests")
        .select(
          `
          *,
          employees (
            id,
            full_name,
            employee_id,
            overtime_group_id,
            profile_picture_url,
            requires_ot_punch
          )
        `
        )
        .gte("ot_date", weekStart)
        .lte("ot_date", weekEnd)
        .order("created_at", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", status);
      }
      if (employeeId !== "all") {
        query = query.eq("employee_id", employeeId);
      }

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);

      let requests = (rows || []) as Array<
        Record<string, unknown> & {
          id: string;
          bundy_in_punch_id?: string | null;
          bundy_out_punch_id?: string | null;
          employees?: { requires_ot_punch?: boolean | null } | null;
        }
      >;

      const docsByRequest: Record<
        string,
        { id: string; file_name: string; file_type: string | null; file_size: number | null }[]
      > = {};
      const punchStatusByRequest: Record<
        string,
        {
          hasCompletedPair: boolean;
          isOpen: boolean;
          lastPunchedAt: string | null;
          lastPunchType: "in" | "out" | null;
          lastLat: number | null;
          lastLng: number | null;
        }
      > = {};

      if (requests.length > 0) {
        const ids = requests.map((r) => r.id);
        const { data: docs, error: docsError } = await supabase
          .from("overtime_documents")
          .select("id, overtime_request_id, file_name, file_type, file_size")
          .in("overtime_request_id", ids);

        if (docsError && !isSchemaMissingTableOrRelationError(docsError)) {
          console.error("ot-approval docs:", docsError);
        } else {
          for (const d of docs || []) {
            const row = d as {
              id: string;
              overtime_request_id: string;
              file_name: string | null;
              file_type: string | null;
              file_size: number | null;
            };
            if (!docsByRequest[row.overtime_request_id]) {
              docsByRequest[row.overtime_request_id] = [];
            }
            docsByRequest[row.overtime_request_id].push({
              id: row.id,
              file_name: row.file_name || "",
              file_type: row.file_type,
              file_size: row.file_size,
            });
          }
        }

        const bundyPunchIds = new Set<string>();
        for (const r of requests) {
          if (r.bundy_in_punch_id) bundyPunchIds.add(r.bundy_in_punch_id);
          if (r.bundy_out_punch_id) bundyPunchIds.add(r.bundy_out_punch_id);
        }

        const punchById: Record<
          string,
          { id: string; punched_at: string; lat: number | null; lng: number | null }
        > = {};
        if (bundyPunchIds.size > 0) {
          const { data: punchRows, error: punchError } = await supabase
            .from("time_entries")
            .select("id, punched_at, lat, lng")
            .in("id", Array.from(bundyPunchIds));
          if (punchError) {
            console.error("ot-approval punches:", punchError);
          } else {
            for (const p of punchRows || []) {
              punchById[(p as { id: string }).id] = p as {
                id: string;
                punched_at: string;
                lat: number | null;
                lng: number | null;
              };
            }
          }
        }

        requests = requests.map((r) => {
          const inP = r.bundy_in_punch_id ? punchById[r.bundy_in_punch_id] : null;
          const outP = r.bundy_out_punch_id ? punchById[r.bundy_out_punch_id] : null;
          const hasPair = Boolean(inP && outP);
          if (r.employees?.requires_ot_punch === true) {
            punchStatusByRequest[r.id] = {
              hasCompletedPair: hasPair,
              isOpen: false,
              lastPunchedAt: outP?.punched_at || inP?.punched_at || null,
              lastPunchType: hasPair ? "out" : inP ? "in" : null,
              lastLat: outP?.lat ?? inP?.lat ?? null,
              lastLng: outP?.lng ?? inP?.lng ?? null,
            };
          }
          return {
            ...r,
            overtime_documents: docsByRequest[r.id] || [],
            bundy_session:
              inP && outP
                ? {
                    clock_in_time: inP.punched_at,
                    clock_out_time: outP.punched_at,
                    clock_in_lat: inP.lat,
                    clock_in_lng: inP.lng,
                    clock_out_lat: outP.lat,
                    clock_out_lng: outP.lng,
                  }
                : null,
          };
        });
      }

      return {
        requests,
        punch_status_by_request: punchStatusByRequest,
        week_start: weekStart,
        week_end: weekEnd,
      };
    },
    CACHE_TTL.list
  );

  return NextResponse.json(data, { headers: { "X-Cache": cache } });
}
