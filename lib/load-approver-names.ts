import type { SupabaseClient } from "@supabase/supabase-js";
import { FINAL_HR_APPROVER_ID } from "@/lib/requestApprovalRouting";

function displayApproverName(
  fullName: string | null | undefined,
  email: string | null | undefined,
  id: string
): string {
  const name = fullName?.trim();
  if (name) return name;
  const mail = email?.trim();
  if (mail) return mail;
  return id;
}

/**
 * Resolve approver display names for auth/profile UUIDs stored on requests.
 * Falls back to employees.id, then employees.user_id (auth link).
 */
export async function loadApproverNameMap(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniq.length === 0) return {};

  const next: Record<string, string> = {};

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uniq);

  if (!profileError && profileRows) {
    for (const row of profileRows as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      next[row.id] = displayApproverName(row.full_name, row.email, row.id);
    }
  }

  let missing = uniq.filter((id) => !next[id]);
  if (missing.length > 0) {
    const { data: employeesById } = await supabase
      .from("employees")
      .select("id, full_name, email")
      .in("id", missing);

    if (employeesById) {
      for (const row of employeesById as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
      }>) {
        next[row.id] = displayApproverName(row.full_name, row.email, row.id);
      }
    }
  }

  missing = uniq.filter((id) => !next[id]);
  if (missing.length > 0) {
    const { data: employeesByUserId } = await supabase
      .from("employees")
      .select("user_id, full_name, email")
      .in("user_id", missing);

    if (employeesByUserId) {
      for (const row of employeesByUserId as Array<{
        user_id: string | null;
        full_name: string | null;
        email: string | null;
      }>) {
        if (!row.user_id) continue;
        next[row.user_id] = displayApproverName(
          row.full_name,
          row.email,
          row.user_id
        );
      }
    }
  }

  missing = uniq.filter((id) => !next[id]);
  if (missing.includes(FINAL_HR_APPROVER_ID)) {
    const { data: hrEmployee } = await supabase
      .from("employees")
      .select("full_name, email")
      .or(
        `user_id.eq.${FINAL_HR_APPROVER_ID},email.ilike.%sapinoso%,full_name.ilike.%sapinoso%`
      )
      .limit(1)
      .maybeSingle();

    if (hrEmployee) {
      next[FINAL_HR_APPROVER_ID] = displayApproverName(
        hrEmployee.full_name,
        hrEmployee.email,
        FINAL_HR_APPROVER_ID
      );
    }
  }

  return next;
}

/** Client-side resolver — uses service-role API (profiles RLS blocks peer lookups in browser). */
export async function fetchApproverNameMap(
  ids: Array<string | null | undefined>
): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniq.length === 0) return {};

  try {
    const res = await fetch("/api/approver-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: uniq }),
    });

    if (!res.ok) {
      console.error("fetchApproverNameMap failed:", res.status, await res.text());
      return {};
    }

    const payload = (await res.json()) as { names?: Record<string, string> };
    return payload.names ?? {};
  } catch (error) {
    console.error("fetchApproverNameMap error:", error);
    return {};
  }
}
