import { createClient } from "@/lib/supabase/client";
import type { VendorType } from "@/types/vendor";

export async function fetchClientsList() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Lightweight masterlist rows for Fund Request client-PO prompts + suggestions. */
export async function fetchPoMasterlistPoLookup() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_masterlist_jobs")
    .select("id, po_number, project_title, location, po_amount, client_name");

  if (error) throw error;
  return data ?? [];
}

/** Lightweight masterlist jobs for grouping under Clients. */
export async function fetchPoMasterlistJobsForClients() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_masterlist_jobs")
    .select(
      "id, client_id, po_number, project_title, location, po_amount, project_status, payment_status, po_date"
    )
    .not("client_id", "is", null)
    .order("po_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveClientOptions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function fetchProjectsList() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_masterlist_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Masterlist jobs for the Internal PO project picker. */
export async function fetchProjectsForPO() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_masterlist_jobs")
    .select("id, po_number, project_title, location, client_name, po_amount")
    .order("project_title", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.project_title as string | null) || "Untitled job",
    code: (row.po_number as string | null) || "—",
    site_address: (row.location as string | null) ?? null,
    client_name: (row.client_name as string | null) ?? null,
    po_amount: row.po_amount == null ? null : Number(row.po_amount),
  }));
}

export async function fetchActiveSuppliersForPO() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select(
      "id, name, contact_person, tin, address, phone, email, phones, emails, type"
    )
    .eq("is_active", true)
    .in("type", ["supplier", "subcontractor"])
    .order("name");

  if (error) throw error;
  return (data ?? []).map((record) => ({
    ...record,
    type:
      record.type === "subcontractor"
        ? ("subcontractor" as const)
        : ("supplier" as const),
  }));
}

export async function fetchActiveSubcontractorOptions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id, name, account_name")
    .eq("is_active", true)
    .eq("type", "subcontractor")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function fetchVendorsByType(type: VendorType) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("type", type)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((record) => ({
    ...record,
    type:
      record.type === "subcontractor"
        ? ("subcontractor" as const)
        : ("supplier" as const),
  }));
}
