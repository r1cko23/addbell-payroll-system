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

function isActiveMasterlistStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toUpperCase();
  return (
    normalized === "ON-GOING" ||
    normalized === "ONGOING" ||
    normalized === "PENDING" ||
    normalized === "ACTIVE" ||
    normalized === ""
  );
}

export async function loadAdminDashboardPayload(): Promise<AdminDashboardPayload> {
  const supabase = getAdminClient();

  const [
    { count: totalEmp },
    { count: activeEmp },
    { count: totalProj },
    { count: pendingFR },
    { count: pendingPO },
    { count: pendingLeave },
    { count: pendingOT },
    { count: pendingFTL },
    projData,
    frData,
    poData,
    amountData,
  ] = await Promise.all([
    supabase.from("employees").select("*", { count: "exact", head: true }),
    supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("employment_status", "active"),
    supabase
      .from("po_masterlist_jobs")
      .select("*", { count: "exact", head: true }),
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
      .from("po_masterlist_jobs")
      .select(
        "id, po_number, project_title, project_status, po_amount, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("fund_requests")
      .select(
        "id, purpose, total_requested_amount, status, request_date, po_number, project_title"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("purchase_orders")
      .select(
        "id, po_number, total_amount, status, created_at, project_title, vendors:vendor_id ( name ), po_masterlist_jobs:po_masterlist_job_id ( project_title )"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("po_masterlist_jobs").select("po_amount, project_status"),
  ]);

  const amountRows = amountData.data || [];
  const totalProjectValue = amountRows.reduce(
    (s: number, p: { po_amount?: number | null }) =>
      s + (Number(p.po_amount) || 0),
    0
  );
  const activeProjects = amountRows.filter((row) =>
    isActiveMasterlistStatus(
      (row as { project_status?: string | null }).project_status
    )
  ).length;

  const projects = (projData.data || []).map(
    (row: {
      id: string;
      po_number: string | null;
      project_title: string | null;
      project_status: string | null;
      po_amount: number | null;
    }) => ({
      id: row.id,
      code: row.po_number || "—",
      name: row.project_title || "Untitled job",
      status: row.project_status || "—",
      contract_value: row.po_amount,
      progress_percentage: null as number | null,
    })
  );

  return {
    stats: {
      totalEmployees: totalEmp || 0,
      activeEmployees: activeEmp || 0,
      totalProjects: totalProj || 0,
      activeProjects,
      pendingFundRequests: pendingFR || 0,
      pendingPOs: pendingPO || 0,
      totalProjectValue,
    },
    projects,
    recentFR: (frData.data || []).map(
      (row: {
        id: string;
        purpose: string;
        total_requested_amount: number;
        status: string;
        request_date: string;
        po_number: string | null;
        project_title: string | null;
      }) => ({
        ...row,
        projects: {
          name: row.project_title || row.po_number || null,
        },
      })
    ),
    recentPO: ((poData.data || []) as Array<{
      id: string;
      po_number: string;
      total_amount: number;
      status: string;
      created_at: string;
      project_title: string | null;
      vendors: { name: string } | { name: string }[] | null;
      po_masterlist_jobs:
        | { project_title: string | null }
        | { project_title: string | null }[]
        | null;
    }>).map((row) => {
        const jobJoin = Array.isArray(row.po_masterlist_jobs)
          ? row.po_masterlist_jobs[0]
          : row.po_masterlist_jobs;
        const vendorJoin = Array.isArray(row.vendors)
          ? row.vendors[0]
          : row.vendors;
        return {
          id: row.id,
          po_number: row.po_number,
          total_amount: row.total_amount,
          status: row.status,
          created_at: row.created_at,
          vendors: vendorJoin,
          projects: {
            name:
              jobJoin?.project_title || row.project_title || null,
          },
        };
      }),
    pendingLeaveApprovals: pendingLeave || 0,
    pendingOvertimeApprovals: pendingOT || 0,
    pendingFailureToLogApprovals: pendingFTL || 0,
  };
}
