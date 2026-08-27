/**
 * Keep linked clients in sync when a masterlist job changes.
 * Projects catalog (`projects` table) is retired — `po_masterlist_jobs` is SoT.
 */

import {
  deriveClientCode,
  normalizeClientIdentityKey,
  splitClientBusinessUnit,
} from "@/lib/billing-sheet-clients";
import { ADD_BELL_MASTERLIST_TAB } from "@/lib/po-masterlist-sheet-import";
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

export async function syncCatalogFromMasterlistJob(
  admin: AdminClient,
  job: PoMasterlistJob
): Promise<{ clientId: string | null }> {
  const companyId = job.company_id ?? (await resolveCompanyId(admin));
  const clientId = await ensureClientForMasterlistJob(
    admin,
    job.client_name,
    companyId
  );

  const linkUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (clientId && clientId !== job.client_id) linkUpdates.client_id = clientId;
  if (companyId && companyId !== job.company_id) linkUpdates.company_id = companyId;

  if (Object.keys(linkUpdates).length > 1) {
    await admin.from("po_masterlist_jobs").update(linkUpdates).eq("id", job.id);
  }

  return { clientId };
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
