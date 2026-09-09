import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export type AdminDashboardPayload = {
  stats: {
    totalEmployees: number;
    activeEmployees: number;
    totalProjects: number;
    activeProjects: number;
    pendingFundRequests: number;
    pendingPOs: number;
    totalProjectValue: number;
  };
  projects: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    contract_value: number | null;
    progress_percentage: number | null;
  }>;
  recentFR: unknown[];
  recentPO: unknown[];
  pendingLeaveApprovals: number;
  pendingOvertimeApprovals: number;
  pendingFailureToLogApprovals: number;
};

export async function loadAdminDashboardPayload(): Promise<AdminDashboardPayload> {
  const supabase = getAdminClient();

  const [
    { count: totalEmp },
    { count: activeEmp },
    { count: totalProj },
    { count: activeProj },
    { count: pendingFR },
    { count: pendingPO },
    { count: pendingLeave },
    { count: pendingOT },
    { count: pendingFTL },
    projData,
    frData,
    poData,
    contractData,
  ] = await Promise.all([
    supabase.from("employees").select("*", { count: "exact", head: true }),
    supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("employment_status", "active"),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("fund_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("overtime_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("failure_to_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("projects")
      .select("id, code, name, status, contract_value, progress_percentage")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("fund_requests")
      .select(
        "id, purpose, total_requested_amount, status, request_date, projects:project_id ( name )"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("purchase_orders")
      .select(
        "id, po_number, total_amount, status, created_at, vendors:vendor_id ( name ), projects:project_id ( name )"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("projects").select("contract_value"),
  ]);

  const totalProjectValue = (contractData.data || []).reduce(
    (s: number, p: { contract_value?: number | null }) =>
      s + (Number(p.contract_value) || 0),
    0
  );

  return {
    stats: {
      totalEmployees: totalEmp || 0,
      activeEmployees: activeEmp || 0,
      totalProjects: totalProj || 0,
      activeProjects: activeProj || 0,
      pendingFundRequests: pendingFR || 0,
      pendingPOs: pendingPO || 0,
      totalProjectValue,
    },
    projects: (projData.data || []) as AdminDashboardPayload["projects"],
    recentFR: frData.data || [],
    recentPO: poData.data || [],
    pendingLeaveApprovals: pendingLeave || 0,
    pendingOvertimeApprovals: pendingOT || 0,
    pendingFailureToLogApprovals: pendingFTL || 0,
  };
}
