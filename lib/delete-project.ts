import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteFundRequestDocumentFiles } from "@/lib/fund-request-document-storage";

async function deletePurchaseOrdersForProject(
  supabase: SupabaseClient,
  projectId: string,
  projectName: string
) {
  const { data: linkedPos, error: linkedError } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("project_id", projectId);

  if (linkedError) throw linkedError;

  const { data: titleOnlyPos, error: titleError } = await supabase
    .from("purchase_orders")
    .select("id")
    .is("project_id", null)
    .eq("project_title", projectName);

  if (titleError) throw titleError;

  const purchaseOrderIds = [
    ...new Set([
      ...(linkedPos ?? []).map((row) => row.id),
      ...(titleOnlyPos ?? []).map((row) => row.id),
    ]),
  ];

  if (purchaseOrderIds.length === 0) return;

  const { error: itemsError } = await supabase
    .from("purchase_order_items")
    .delete()
    .in("purchase_order_id", purchaseOrderIds);

  if (itemsError) throw itemsError;

  const { error: deleteError } = await supabase
    .from("purchase_orders")
    .delete()
    .in("id", purchaseOrderIds);

  if (deleteError) throw deleteError;
}

async function deleteFundRequestsForProject(
  supabase: SupabaseClient,
  projectId: string,
  projectName: string
) {
  const { data: linkedRequests, error: linkedError } = await supabase
    .from("fund_requests")
    .select("id")
    .eq("project_id", projectId);

  if (linkedError) throw linkedError;

  const { data: titleOnlyRequests, error: titleError } = await supabase
    .from("fund_requests")
    .select("id")
    .is("project_id", null)
    .eq("project_title", projectName);

  if (titleError) throw titleError;

  const fundRequestIds = [
    ...new Set([
      ...(linkedRequests ?? []).map((row) => row.id),
      ...(titleOnlyRequests ?? []).map((row) => row.id),
    ]),
  ];

  if (fundRequestIds.length === 0) return;

  await deleteFundRequestDocumentFiles(supabase, fundRequestIds);

  const { error: documentsError } = await supabase
    .from("fund_request_documents")
    .delete()
    .in("fund_request_id", fundRequestIds);

  if (documentsError) throw documentsError;

  const { error: deleteError } = await supabase
    .from("fund_requests")
    .delete()
    .in("id", fundRequestIds);

  if (deleteError) throw deleteError;
}

async function deleteProjectChildren(
  supabase: SupabaseClient,
  projectId: string
) {
  const childTables = [
    "project_time_entries",
    "project_progress",
    "project_assignments",
    "project_costs",
    "project_manpower_costs",
  ] as const;

  for (const table of childTables) {
    const { error } = await supabase.from(table).delete().eq("project_id", projectId);
    if (error && error.code !== "42P01") {
      throw error;
    }
  }
}

export async function deleteProjectWithDependencies(
  supabase: SupabaseClient,
  projectId: string
) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error("Project not found.");
  }

  await deletePurchaseOrdersForProject(supabase, projectId, project.name);
  await deleteFundRequestsForProject(supabase, projectId, project.name);
  await deleteProjectChildren(supabase, projectId);

  const { error: deleteProjectError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (deleteProjectError) {
    throw deleteProjectError;
  }
}
