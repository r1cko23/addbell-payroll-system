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

  const status = req.nextUrl.searchParams.get("status") || "all";
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

  const supabase = createServerComponentClient<Database>({ cookies });

  // Shared key across dashboard users — employee directory is the same after auth.
  const { data, cache } = await cachedJson(
    ["employees-list", status, q || ""],
    async () => {
      const [employeesRes, deptsRes, positionsRes, groupsRes] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "*, departments:department_id ( name ), positions:position_id ( name, job_grade )"
          )
          .order("last_name", { ascending: true })
          .order("first_name", { ascending: true }),
        supabase
          .from("departments")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase.from("positions").select("id, name, job_grade").order("name"),
        supabase
          .from("overtime_groups")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (employeesRes.error) throw new Error(employeesRes.error.message);

      let employees = employeesRes.data || [];
      if (status !== "all") {
        employees = employees.filter(
          (e: { employment_status?: string | null }) =>
            (e.employment_status || "").toLowerCase() === status.toLowerCase()
        );
      }
      if (q) {
        employees = employees.filter((e: Record<string, unknown>) => {
          const hay = [e.full_name, e.employee_id, e.employee_code, e.email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
      }

      return {
        employees,
        departments: deptsRes.data || [],
        positions: positionsRes.data || [],
        overtimeGroups: groupsRes.data || [],
      };
    },
    CACHE_TTL.list
  );

  return NextResponse.json(data, { headers: { "X-Cache": cache } });
}
