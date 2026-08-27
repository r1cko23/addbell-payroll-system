import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { CACHE_TTL, cachedJson } from "@/lib/cache";
import { verifyDashboardUser } from "@/lib/api-helpers";
import { addDays, format, parse } from "date-fns";

export { dynamic } from "@/lib/api-route-segment";

const INBOX_SELECT = `
  *,
  employees (
    id,
    full_name,
    first_name,
    last_name,
    employee_id,
    profile_picture_url,
    user_id
  ),
  vendors ( id, name, type )
`;

export async function GET(req: NextRequest) {
  const auth = await verifyDashboardUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tab = req.nextUrl.searchParams.get("tab") || "inbox";
  const cutoffStart = req.nextUrl.searchParams.get("cutoff_start") || "";
  const fetchFrom = req.nextUrl.searchParams.get("fetch_from");
  const fetchTo = req.nextUrl.searchParams.get("fetch_to");

  const supabase = createServerComponentClient<Database>({ cookies });

  // Shared key: raw rows are the same; role buckets are applied client-side.
  const { data, cache } = await cachedJson(
    ["fund-requests-list", tab, cutoffStart, fetchFrom || "", fetchTo || ""],
    async () => {
      let query = supabase
        .from("fund_requests")
        .select(INBOX_SELECT)
        .order("created_at", { ascending: false });

      if (fetchFrom && fetchTo) {
        const fetchToExtended = format(
          addDays(parse(fetchTo, "yyyy-MM-dd", new Date()), 7),
          "yyyy-MM-dd"
        );
        query = query
          .gte("created_at", `${fetchFrom}T00:00:00+08:00`)
          .lte("created_at", `${fetchToExtended}T23:59:59+08:00`);
      }

      if (tab === "history") {
        query = query.or(
          "status.eq.management_approved,and(status.eq.rejected,purchasing_officer_approved_at.not.is.null)"
        );
      }

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);

      return {
        rows: rows || [],
        tab,
        cutoff_start: cutoffStart,
      };
    },
    CACHE_TTL.list,
    { revalidate: req.headers.get("x-cache-revalidate") === "1" }
  );

  return NextResponse.json(data, {
    headers: {
      "X-Cache": cache,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
