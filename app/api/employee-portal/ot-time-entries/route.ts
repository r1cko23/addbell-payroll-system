import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export { dynamic } from "@/lib/api-route-segment";


function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type OtPunch = {
  id: string;
  employee_id: string;
  ot_request_id: string;
  punch_type: "in" | "out";
  punched_at: string;
  lat: number | null;
  lng: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    const otRequestId = req.nextUrl.searchParams.get("ot_request_id");
    const includeAllByEmployee =
      req.nextUrl.searchParams.get("all_for_employee") === "true";

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    if (!otRequestId && !includeAllByEmployee) {
      return NextResponse.json(
        {
          error:
            "Provide ot_request_id or set all_for_employee=true to load OT punches",
        },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    let query = admin
      .from("ot_time_entries")
      .select("id, employee_id, ot_request_id, punch_type, punched_at, lat, lng")
      .eq("employee_id", employeeId)
      .order("punched_at", { ascending: true });

    if (otRequestId) {
      query = query.eq("ot_request_id", otRequestId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const punches = (data || []) as OtPunch[];

    const computeSummary = (list: OtPunch[]) => {
      let open = false;
      let pairs = 0;
      list.forEach((p) => {
        if (p.punch_type === "in" && !open) {
          open = true;
        } else if (p.punch_type === "out" && open) {
          open = false;
          pairs += 1;
        }
      });
      const last = list[list.length - 1] || null;
      return {
        is_open: open,
        has_completed_pair: pairs > 0 && !open,
        last_punch_type: last?.punch_type || null,
        last_punched_at: last?.punched_at || null,
      };
    };

    if (includeAllByEmployee) {
      const grouped: Record<string, OtPunch[]> = {};
      punches.forEach((p) => {
        if (!grouped[p.ot_request_id]) grouped[p.ot_request_id] = [];
        grouped[p.ot_request_id].push(p);
      });
      const summaries_by_request: Record<
        string,
        {
          is_open: boolean;
          has_completed_pair: boolean;
          last_punch_type: "in" | "out" | null;
          last_punched_at: string | null;
        }
      > = {};
      Object.entries(grouped).forEach(([reqId, list]) => {
        summaries_by_request[reqId] = computeSummary(list);
      });
      return NextResponse.json({ punches, summaries_by_request });
    }

    return NextResponse.json({ punches, summary: computeSummary(punches) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
