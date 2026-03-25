import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Employee ids where this user is the per-employee OT approver or viewer.
 * Returns [] if the columns are missing or the query fails (avoids PostgREST 400 on some schemas).
 */
export async function fetchEmployeeIdsForOtApproverOrViewer(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .or(`overtime_approver_id.eq.${userId},overtime_viewer_id.eq.${userId}`);

  if (error) {
    return [];
  }
  return (data ?? []).map((r: { id: string }) => r.id).filter(Boolean);
}
