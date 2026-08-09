import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { CACHE_TTL, cachedJson } from "@/lib/cache";
import { verifyDashboardUser } from "@/lib/api-helpers";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";

export { dynamic } from "@/lib/api-route-segment";

export async function GET(req: NextRequest) {
  const auth = await verifyDashboardUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateFrom = req.nextUrl.searchParams.get("date_from");
  const dateTo = req.nextUrl.searchParams.get("date_to");
  const status = req.nextUrl.searchParams.get("status") || "all";
  const employeeId = req.nextUrl.searchParams.get("employee_id") || "all";

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "date_from and date_to are required" },
      { status: 400 }
    );
  }

  const supabase = createServerComponentClient<Database>({ cookies });

  // Shared key: list payload is identical; visibility filtering is client-side.
  const { data, cache } = await cachedJson(
    ["leave-approval", dateFrom, dateTo, status, employeeId],
    async () => {
      // Leave overlaps selected week when start_date <= weekEnd AND end_date >= weekStart
      let query = supabase
        .from("leave_requests")
        .select("*")
        .lte("start_date", dateTo)
        .gte("end_date", dateFrom)
        .order("created_at", { ascending: false });

      if (status !== "all") {
        if (status === "approved_by_pm") {
          query = query.in("status", ["approved_by_pm", "approved_by_manager"]);
        } else {
          query = query.eq("status", status);
        }
      }
      if (employeeId !== "all") {
        query = query.eq("employee_id", employeeId);
      }

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);

      const rawRequests = (rows || []) as Array<
        Record<string, unknown> & { id: string; employee_id: string }
      >;

      const employeeIds = Array.from(
        new Set(rawRequests.map((r) => r.employee_id).filter(Boolean))
      );
      let employeeById: Record<string, Record<string, unknown>> = {};
      if (employeeIds.length > 0) {
        const { data: employeeRows } = await supabase
          .from("employees")
          .select("id, employee_id, full_name, profile_picture_url, sil_credits")
          .in("id", employeeIds);
        for (const row of employeeRows || []) {
          const e = row as { id: string };
          employeeById[e.id] = row as Record<string, unknown>;
        }
      }

      let docsByRequestId: Record<
        string,
        { id: string; leave_request_id: string; file_name: string | null; file_type: string | null; file_size: number | null }[]
      > = {};
      if (rawRequests.length > 0) {
        const requestIds = rawRequests.map((r) => r.id);
        const { data: docs, error: docsError } = await supabase
          .from("leave_request_documents")
          .select("id, leave_request_id, file_name, file_type, file_size")
          .in("leave_request_id", requestIds);

        if (docsError && !isSchemaMissingTableOrRelationError(docsError)) {
          console.error("leave-approval docs:", docsError);
        } else {
          for (const doc of docs || []) {
            const d = doc as {
              id: string;
              leave_request_id: string;
              file_name: string | null;
              file_type: string | null;
              file_size: number | null;
            };
            if (!docsByRequestId[d.leave_request_id]) {
              docsByRequestId[d.leave_request_id] = [];
            }
            docsByRequestId[d.leave_request_id].push(d);
          }
        }
      }

      const requests = rawRequests.map((r) => ({
        ...r,
        employees: employeeById[r.employee_id] || {
          employee_id: null,
          full_name: "Unknown Employee",
          profile_picture_url: null,
          sil_credits: 0,
        },
        leave_request_documents: docsByRequestId[r.id] || [],
      }));

      return {
        requests,
        date_from: dateFrom,
        date_to: dateTo,
      };
    },
    CACHE_TTL.list
  );

  return NextResponse.json(data, { headers: { "X-Cache": cache } });
}
