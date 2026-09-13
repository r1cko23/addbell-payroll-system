/**
 * Keep linked clients (and a projects catalog row for fund requests) in sync
 * when a masterlist job is created. Do not generate ML-* codes.
 */

import {
  deriveClientCode,
  normalizeClientIdentityKey,
  splitClientBusinessUnit,
} from "@/lib/billing-sheet-clients";
import {
  ADD_BELL_MASTERLIST_TAB,
  mapAddBellProjectStatusToApp,
} from "@/lib/po-masterlist-sheet-import";
import { nextProjectCodeFromPoNumber } from "@/lib/po-masterlist-project-code";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import type { getAdminClient } from "@/lib/fund-request-api";

type AdminClient = ReturnType<typeof getAdminClient>;

async function resolveCompanyId(admin: AdminClient): Promise<string | null> {
  const { data } = await admin
    .from("companies")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function ensureClientForMasterlistJob(
  admin: AdminClient,
  clientName: string | null | undefined,
  companyId: string | null
): Promise<string | null> {
  const name = clientName?.trim();
  if (!name) return null;

  const key = normalizeClientIdentityKey(name);
  if (!key) return null;

  const { data: existing } = await admin
    .from("clients")
    .select("id, name, client_code, company_id, business_unit_sub_company")
    .limit(500);

  const match = (existing ?? []).find(
    (row) => normalizeClientIdentityKey(row.name ?? "") === key
  );
  if (match) {
    const { businessUnit } = splitClientBusinessUnit(name);
    const updates: Record<string, string | null> = {};
    // Prefer masterlist spelling when it differs only by punctuation/case/spacing.
    if (
      match.name?.trim() &&
      normalizeClientIdentityKey(match.name) === key &&
      match.name.trim() !== name
    ) {
      updates.name = name;
    }
    if (!match.company_id && companyId) updates.company_id = companyId;
    if (!match.business_unit_sub_company && businessUnit) {
      updates.business_unit_sub_company = businessUnit;
    }
    if (Object.keys(updates).length > 0) {
      await admin.from("clients").update(updates).eq("id", match.id);
    }
    return match.id as string;
  }

  const { data: allCodes } = await admin.from("clients").select("client_code");
  const used = new Set<string>();
  for (const row of allCodes ?? []) {
    if (row.client_code?.trim()) used.add(row.client_code.trim().toUpperCase());
  }
  const { businessUnit } = splitClientBusinessUnit(name);
  const { data: created, error } = await admin
    .from("clients")
    .insert({
      company_id: companyId,
      name,
      client_code: deriveClientCode(name, used),
      business_unit_sub_company: businessUnit,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create client");
  }
  return created.id as string;
}

export async function ensureProjectForMasterlistJob(
  admin: AdminClient,
  job: PoMasterlistJob,
  clientId: string | null,
  companyId: string | null
): Promise<string | null> {
  if (job.project_id) return job.project_id;
  const poNumber = job.po_number?.trim();
  if (!poNumber) return null;

  const { data: existingCodes, error: codesError } = await admin
    .from("projects")
    .select("code");
  if (codesError) throw new Error(codesError.message);

  const used = new Set<string>();
  for (const row of existingCodes ?? []) {
    if (row.code?.trim()) used.add(row.code.trim());
  }
  const code = nextProjectCodeFromPoNumber(poNumber, used);
  const now = new Date().toISOString();
  const { data: created, error } = await admin
    .from("projects")
    .insert({
      company_id: companyId,
      client_id: clientId,
      code,
      name: job.project_title?.trim() || poNumber,
      site_address: job.location,
      status: mapAddBellProjectStatusToApp(job.project_status),
      contract_value: job.po_amount,
      start_date: job.po_date,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create project for job");
  }
  return created.id as string;
}

export async function syncCatalogFromMasterlistJob(
  admin: AdminClient,
  job: PoMasterlistJob
): Promise<{ clientId: string | null; projectId: string | null }> {
  const companyId = job.company_id ?? (await resolveCompanyId(admin));
  const clientId = await ensureClientForMasterlistJob(
    admin,
    job.client_name,
    companyId
  );
  const projectId = await ensureProjectForMasterlistJob(
    admin,
    job,
    clientId,
    companyId
  );

  const linkUpdates: Record<string, unknown> = {};
  if (clientId && clientId !== job.client_id) linkUpdates.client_id = clientId;
  if (companyId && companyId !== job.company_id) linkUpdates.company_id = companyId;
  if (projectId && projectId !== job.project_id) linkUpdates.project_id = projectId;

  if (Object.keys(linkUpdates).length > 0) {
    linkUpdates.updated_at = new Date().toISOString();
    await admin.from("po_masterlist_jobs").update(linkUpdates).eq("id", job.id);
  }

  return { clientId, projectId };
}

export async function nextAddBellSheetRow(
  admin: AdminClient
): Promise<number | null> {
  const { data, error } = await admin
    .from("po_masterlist_jobs")
    .select("sheet_row")
    .eq("sheet_tab", ADD_BELL_MASTERLIST_TAB)
    .not("sheet_row", "is", null)
    .order("sheet_row", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.sheet_row == null) return 4; // header is typically row 3
  return Number(data.sheet_row) + 1;
}

export { resolveCompanyId };
