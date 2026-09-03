/**
 * Backfill clients from the CLIENT column on billing invoice booklet tabs
 * (the same workbook used to look up invoice numbers by P.O.).
 *
 * Usage: npx tsx scripts/backfill-clients-from-billing-sheet.ts
 */
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  collectBillingSheetClientPoRows,
  isGoogleSheetsBillingConfigured,
} from "../lib/google-sheets-billing-invoice";
import {
  deriveClientCode,
  normalizeBillingPoNumber,
  normalizeClientNameKey,
  preferredClientNameByPo,
  splitClientBusinessUnit,
  uniqueClientNames,
} from "../lib/billing-sheet-clients";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables in .env.local");
    process.exit(1);
  }
  if (!isGoogleSheetsBillingConfigured()) {
    console.error("Google Sheets billing lookup is not configured in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = await collectBillingSheetClientPoRows();
  const names = uniqueClientNames(rows);
  const poToClient = preferredClientNameByPo(rows);
  console.log(`Sheet rows with P.O. + client: ${rows.length}`);
  console.log(`Unique clients: ${names.length}`);
  console.log(`P.O.s mapped to a client: ${poToClient.size}`);

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const companyId = company?.id ?? null;

  const { data: existingClients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, client_code, company_id, business_unit_sub_company");
  if (clientsError) {
    console.error("Failed to load clients:", clientsError.message);
    process.exit(1);
  }

  const idByNameKey = new Map<string, string>();
  const usedCodes = new Set<string>();
  for (const client of existingClients ?? []) {
    idByNameKey.set(normalizeClientNameKey(client.name), client.id);
    if (client.client_code?.trim()) usedCodes.add(client.client_code.trim().toUpperCase());
  }

  let inserted = 0;
  for (const name of names) {
    const key = normalizeClientNameKey(name);
    const existingId = idByNameKey.get(key);
    const { businessUnit } = splitClientBusinessUnit(name);
    if (existingId) {
      const existing = (existingClients ?? []).find((client) => client.id === existingId);
      const updates: Record<string, string | null> = {};
      if (!existing?.company_id && companyId) updates.company_id = companyId;
      if (!existing?.business_unit_sub_company && businessUnit) {
        updates.business_unit_sub_company = businessUnit;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("clients").update(updates).eq("id", existingId);
      }
      continue;
    }

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        company_id: companyId,
        name,
        client_code: deriveClientCode(name, usedCodes),
        business_unit_sub_company: businessUnit,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (error || !created) {
      console.error(`Failed to insert ${name}:`, error?.message);
      continue;
    }
    idByNameKey.set(key, created.id);
    inserted += 1;
    console.log(`Inserted client ${created.name}`);
  }

  // Link masterlist jobs to clients by billing-sheet P.O. → CLIENT mapping.
  const { data: jobs, error: jobsError } = await supabase
    .from("po_masterlist_jobs")
    .select("id, po_number, client_id, project_title");
  if (jobsError) {
    console.error("Failed to load po_masterlist_jobs:", jobsError.message);
    process.exit(1);
  }

  let linked = 0;
  for (const job of jobs ?? []) {
    if (job.client_id) continue;
    const clientName = poToClient.get(normalizeBillingPoNumber(job.po_number ?? ""));
    if (!clientName) continue;
    const clientId = idByNameKey.get(normalizeClientNameKey(clientName));
    if (!clientId) continue;
    const { error } = await supabase
      .from("po_masterlist_jobs")
      .update({
        client_id: clientId,
        client_name: clientName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) {
      console.error(`Failed to link job ${job.id}:`, error.message);
      continue;
    }
    linked += 1;
  }

  let titleLinked = 0;
  for (const job of jobs ?? []) {
    if (job.client_id) continue;
    const titleKey = normalizeClientNameKey(job.project_title ?? "");
    if (!titleKey) continue;
    let matchedId: string | null = null;
    for (const [nameKey, clientId] of idByNameKey) {
      if (titleKey.includes(nameKey) || nameKey.includes(titleKey)) {
        matchedId = clientId;
        break;
      }
    }
    if (!matchedId) continue;
    const { error } = await supabase
      .from("po_masterlist_jobs")
      .update({
        client_id: matchedId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) continue;
    titleLinked += 1;
  }

  console.log(
    `Done. Inserted ${inserted} clients, linked ${linked} jobs by P.O., ${titleLinked} by title.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
