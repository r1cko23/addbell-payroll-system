import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchApproverNameMap } from "@/lib/load-approver-names";
import { normalizeUserRole } from "@/lib/user-roles";

export type FundRequestRequesterInfo = {
  name: string;
  userId: string | null;
  isOperationsManager: boolean;
};

function employeeDisplayName(emp: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  employee_id?: string | null;
}): string {
  const parts = [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim();
  return parts || emp.full_name?.trim() || emp.employee_id?.trim() || "";
}

export async function resolveFundRequestRequesterMap(
  supabase: SupabaseClient,
  requestedByIds: string[]
): Promise<Record<string, FundRequestRequesterInfo>> {
  const uniq = [...new Set(requestedByIds.filter(Boolean))];
  if (uniq.length === 0) return {};

  const [nameMap, { data: employeesById }, { data: employeesByUserId }] =
    await Promise.all([
      fetchApproverNameMap(uniq),
      supabase
        .from("employees")
        .select("id, user_id, first_name, last_name, full_name, employee_id")
        .in("id", uniq),
      supabase
        .from("employees")
        .select("id, user_id, first_name, last_name, full_name, employee_id")
        .in("user_id", uniq),
    ]);

  const userIds = [
    ...new Set(
      [...(employeesById ?? []), ...(employeesByUserId ?? [])]
        .map((employee) => employee.user_id)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];

  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, role, full_name").in("id", userIds)
      : { data: [] as Array<{ id: string; role: string | null; full_name: string | null }> };

  const profileByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const employeeById = new Map((employeesById ?? []).map((employee) => [employee.id, employee]));
  const employeeByUserId = new Map(
    (employeesByUserId ?? [])
      .filter((employee) => employee.user_id)
      .map((employee) => [employee.user_id as string, employee])
  );

  const result: Record<string, FundRequestRequesterInfo> = {};
  for (const id of uniq) {
    const employee = employeeById.get(id) ?? employeeByUserId.get(id);
    const userId =
      employee?.user_id ?? (employeeByUserId.has(id) ? id : null);
    const profile = userId ? profileByUserId.get(userId) : undefined;
    const employeeName = employee ? employeeDisplayName(employee) : "";
    const resolvedName =
      profile?.full_name?.trim() ||
      employeeName ||
      nameMap[id] ||
      "Unknown requester";

    result[id] = {
      name: resolvedName,
      userId: employee?.user_id ?? profile?.id ?? null,
      isOperationsManager:
        normalizeUserRole(profile?.role) === "operations_manager",
    };
  }

  return result;
}

export async function resolveFundRequestRequesterInfo(
  supabase: SupabaseClient,
  requestedBy: string
): Promise<FundRequestRequesterInfo> {
  const map = await resolveFundRequestRequesterMap(supabase, [requestedBy]);
  return (
    map[requestedBy] ?? {
      name: "Unknown requester",
      userId: null,
      isOperationsManager: false,
    }
  );
}
