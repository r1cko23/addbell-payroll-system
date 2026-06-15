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
    .from("projects")
    .select("*, clients:client_id ( name )")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchProjectsForPO() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, code, site_address")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveSuppliersForPO() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select(
      "id, name, contact_person, tin, address, phone, email, phones, emails"
    )
    .eq("is_active", true)
    .eq("type", "supplier")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveSubcontractorOptions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id, name")
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
