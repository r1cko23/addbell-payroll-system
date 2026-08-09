import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { CACHE_TTL, cachedJson } from "@/lib/cache";
import { verifyDashboardUser } from "@/lib/api-helpers";

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
    ["ftl-approval", dateFrom, dateTo, status, employeeId],
    async () => {
      let query = supabase
        .from("failure_to_log")
        .select("*")
        .gte("missed_date", dateFrom)
        .lte("missed_date", dateTo)
        .order("created_at", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", status);
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
          .select("id, employee_id, full_name, profile_picture_url")
          .in("id", employeeIds);
        for (const row of employeeRows || []) {
          const e = row as { id: string };
          employeeById[e.id] = row as Record<string, unknown>;
        }
      }

      const requests = rawRequests.map((r) => ({
        ...r,
        employees: employeeById[r.employee_id] || {
          employee_id: null,
          full_name: "Unknown Employee",
          profile_picture_url: null,
        },
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
