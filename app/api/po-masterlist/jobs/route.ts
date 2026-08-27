import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { getAdminClient } from "@/lib/fund-request-api";
import { mergePermissions } from "@/lib/permissions";
import {
  canCreatePoMasterlistJob,
  getEditablePoMasterlistColumnsForRole,
} from "@/lib/po-masterlist-column-acl";
import { schedulePoMasterlistSheetWriteback } from "@/lib/po-masterlist-sheet-writeback";
import {
  nextAddBellSheetRow,
  resolveCompanyId,
  syncCatalogFromMasterlistJob,
} from "@/lib/po-masterlist-job-sync";
import { ADD_BELL_MASTERLIST_TAB } from "@/lib/po-masterlist-sheet-import";
import type { PoMasterlistJob } from "@/types/po-masterlist";

export { dynamic } from "@/lib/api-route-segment";

const PO_MASTERLIST_MIN_YEAR = 2022;

/** Reject typo years like 206 from dates such as 0206-09-15. */
function isPlausiblePoYear(year: number): boolean {
  const maxYear = new Date().getFullYear() + 1;
  return Number.isFinite(year) && year >= PO_MASTERLIST_MIN_YEAR && year <= maxYear;
}

function yearFromPoDate(poDate: string | null | undefined): number | null {
  if (!poDate) return null;
  const match = /^(\d{4})/.exec(poDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  return isPlausiblePoYear(year) ? year : null;
}

function poDateSortKey(poDate: string | null | undefined): number {
  if (!poDate) return 0;
  const t = Date.parse(poDate);
  return Number.isFinite(t) ? t : 0;
}

function parseMultiParam(
  searchParams: URLSearchParams,
  key: string
): string[] {
  // Prefer repeated params (clients=A&clients=B) so values may contain commas.
  return searchParams
    .getAll(key)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesAnyProjectStatus(
  jobStatus: string | null | undefined,
  selected: string[]
): boolean {
  if (selected.length === 0) return true;
  const normalized = (jobStatus ?? "").trim().toUpperCase();
  return selected.some((filter) => {
    const needle = filter.trim().toUpperCase();
    if (needle === "ON-GOING" || needle === "ONGOING") {
      return normalized === "ON-GOING" || normalized === "ONGOING";
    }
    if (needle === "CURRENT") {
      return (
        normalized === "ON-GOING" ||
        normalized === "ONGOING" ||
        normalized === "PENDING"
      );
    }
    return normalized === needle;
  });
}

function matchesAnyPaymentStatus(
  jobStatus: string | null | undefined,
  selected: string[]
): boolean {
  if (selected.length === 0) return true;
  const normalized = (jobStatus ?? "").trim().toUpperCase();
  return selected.some((filter) => filter.trim().toUpperCase() === normalized);
}

function sortJobsNewestFirst(jobs: PoMasterlistJob[]): PoMasterlistJob[] {
  return [...jobs].sort((a, b) => {
    const byDate = poDateSortKey(b.po_date) - poDateSortKey(a.po_date);
    if (byDate !== 0) return byDate;
    return (b.sheet_row ?? 0) - (a.sheet_row ?? 0);
  });
}

async function getProjectsAccess(): Promise<{
  userId: string;
  role: string;
  canRead: boolean;
  canUpdate: boolean;
  canCreate: boolean;
} | null> {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, permissions, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) return null;

  const permissions = mergePermissions(
    profile.role,
    profile.permissions as Parameters<typeof mergePermissions>[1]
  );

  return {
    userId: user.id,
    role: profile.role,
    canRead: permissions.projects.read,
    canUpdate: permissions.projects.update,
    canCreate: permissions.projects.create || canCreatePoMasterlistJob(profile.role),
  };
}

export async function GET(req: NextRequest) {
  try {
    const access = await getProjectsAccess();
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const projectStatuses = parseMultiParam(searchParams, "project_statuses");
    const paymentStatuses = parseMultiParam(searchParams, "payment_statuses");
    const clients = parseMultiParam(searchParams, "clients");
    const years = parseMultiParam(searchParams, "years")
      .map((value) => Number(value))
      .filter((year) => isPlausiblePoYear(year));
    // Backward-compatible single params
    const legacyProjectStatus = searchParams.get("project_status")?.trim() ?? "";
    const legacyPaymentStatus = searchParams.get("payment_status")?.trim() ?? "";
    const legacyClient = searchParams.get("client")?.trim() ?? "";
    const legacyYear = searchParams.get("year")?.trim() ?? "";
    const pageRaw = Number(searchParams.get("page") ?? "1");
    const pageSizeRaw = Number(searchParams.get("pageSize") ?? "20");
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(100, Math.max(1, Math.floor(pageSizeRaw)))
      : 20;

    const effectiveProjectStatuses =
      projectStatuses.length > 0
        ? projectStatuses
        : legacyProjectStatus && legacyProjectStatus !== "all"
          ? [legacyProjectStatus]
          : [];
    const effectivePaymentStatuses =
      paymentStatuses.length > 0
        ? paymentStatuses
        : legacyPaymentStatus && legacyPaymentStatus !== "all"
          ? [legacyPaymentStatus]
          : [];
    const effectiveClients =
      clients.length > 0
        ? clients
        : legacyClient && legacyClient !== "all"
          ? [legacyClient]
          : [];
    const effectiveYears =
      years.length > 0
        ? years
        : legacyYear && legacyYear !== "all" && isPlausiblePoYear(Number(legacyYear))
          ? [Number(legacyYear)]
          : [];

    const admin = getAdminClient();
    const query = admin
      .from("po_masterlist_jobs")
      .select("*")
      .eq("sheet_tab", ADD_BELL_MASTERLIST_TAB)
      .order("sheet_row", { ascending: true });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allJobs = (data ?? []) as PoMasterlistJob[];

    // One filter option per client identity (ignore punctuation/spacing variants).
    const clientSpellCounts = new Map<string, Map<string, number>>();
    const yearSet = new Set<number>();
    for (const job of allJobs) {
      const name = job.client_name?.trim();
      if (name) {
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
        if (key) {
          const spells = clientSpellCounts.get(key) ?? new Map<string, number>();
          spells.set(name, (spells.get(name) ?? 0) + 1);
          clientSpellCounts.set(key, spells);
        }
      }
      const poYear = yearFromPoDate(job.po_date);
      if (poYear != null) yearSet.add(poYear);
    }
    const uniqueClients: string[] = [];
    for (const spells of clientSpellCounts.values()) {
      let bestName = "";
      let bestCount = -1;
      for (const [name, count] of spells) {
        if (
          count > bestCount ||
          (count === bestCount && name.localeCompare(bestName) < 0)
        ) {
          bestName = name;
          bestCount = count;
        }
      }
      if (bestName) uniqueClients.push(bestName);
    }
    const filterOptions = {
      clients: uniqueClients.sort((a, b) => a.localeCompare(b)),
      years: Array.from(yearSet).sort((a, b) => b - a),
    };

    let jobs = allJobs;
    // Default backtrack window: current → 2022 (also applied when year=all).
    jobs = jobs.filter((job) => {
      const poYear = yearFromPoDate(job.po_date);
      if (poYear == null) return false;
      return poYear >= PO_MASTERLIST_MIN_YEAR;
    });

    if (effectiveProjectStatuses.length > 0) {
      jobs = jobs.filter((job) =>
        matchesAnyProjectStatus(job.project_status, effectiveProjectStatuses)
      );
    }
    if (effectivePaymentStatuses.length > 0) {
      jobs = jobs.filter((job) =>
        matchesAnyPaymentStatus(job.payment_status, effectivePaymentStatuses)
      );
    }
    if (effectiveClients.length > 0) {
      const selectedKeys = new Set(
        effectiveClients.map((client) =>
          client.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
        )
      );
      jobs = jobs.filter((job) => {
        const key = (job.client_name ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");
        return key.length > 0 && selectedKeys.has(key);
      });
    }
    if (effectiveYears.length > 0) {
      const selectedYearSet = new Set(effectiveYears);
      jobs = jobs.filter((job) => {
        const poYear = yearFromPoDate(job.po_date);
        return poYear != null && selectedYearSet.has(poYear);
      });
    }
    if (q) {
      const needle = q.toLowerCase();
      jobs = jobs.filter((job) => {
        const hay = [
          job.po_number,
          job.project_title,
          job.client_name,
          job.location,
          job.invoice_numbers,
          job.general_remarks,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    jobs = sortJobsNewestFirst(jobs);

    const total = jobs.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;
    const pagedJobs = jobs.slice(start, start + pageSize);

    return NextResponse.json({
      jobs: pagedJobs,
      total,
      page: safePage,
      pageSize,
      pageCount,
      filterOptions,
      editableColumns: getEditablePoMasterlistColumnsForRole(access.role),
      canCreate: canCreatePoMasterlistJob(access.role) && access.canCreate,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list jobs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await getProjectsAccess();
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canCreatePoMasterlistJob(access.role)) {
      return NextResponse.json(
        { error: "Forbidden", fields: ["create"] },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const poNumber =
      typeof body.po_number === "string" ? body.po_number.trim() : "";
    const projectTitle =
      typeof body.project_title === "string" ? body.project_title.trim() : "";
    const clientName =
      typeof body.client_name === "string" ? body.client_name.trim() : "";

    if (!poNumber || !projectTitle || !clientName) {
      return NextResponse.json(
        {
          error:
            "po_number, project_title, and client_name are required to create a job",
        },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const companyId = await resolveCompanyId(admin);
    const sheetRow = await nextAddBellSheetRow(admin);
    const now = new Date().toISOString();

    const insertPayload = {
      company_id: companyId,
      po_number: poNumber,
      po_date: (body.po_date as string | null) ?? null,
      po_received_date: (body.po_received_date as string | null) ?? null,
      po_amount:
        body.po_amount == null || body.po_amount === ""
          ? null
          : Number(body.po_amount),
      project_title: projectTitle,
      client_name: clientName,
      location: (body.location as string | null) ?? null,
      payment_terms: (body.payment_terms as string | null) ?? null,
      cari: (body.cari as string | null) ?? null,
      cari_expiry: (body.cari_expiry as string | null) ?? null,
      project_status: (body.project_status as string | null) ?? null,
      payment_status: (body.payment_status as string | null) ?? null,
      invoice_numbers: (body.invoice_numbers as string | null) ?? null,
      general_remarks: (body.general_remarks as string | null) ?? null,
      sheet_tab: ADD_BELL_MASTERLIST_TAB,
      sheet_row: sheetRow,
      sheet_synced_at: null,
      sheet_sync_error: null,
      created_at: now,
      updated_at: now,
    };

    const { data: created, error } = await admin
      .from("po_masterlist_jobs")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !created) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create job" },
        { status: 500 }
      );
    }

    let job = created as unknown as PoMasterlistJob;
    const links = await syncCatalogFromMasterlistJob(admin, job);
    if (links.clientId) {
      const { data: refreshed } = await admin
        .from("po_masterlist_jobs")
        .select("*")
        .eq("id", job.id)
        .single();
      if (refreshed) job = refreshed as unknown as PoMasterlistJob;
    }

    if (job.sheet_tab && job.sheet_row != null) {
      schedulePoMasterlistSheetWriteback(job.id);
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create job" },
      { status: 500 }
    );
  }
}
