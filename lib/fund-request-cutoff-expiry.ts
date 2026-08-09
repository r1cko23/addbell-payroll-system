import type { SupabaseClient } from "@supabase/supabase-js";
import type { FundRequestRow } from "@/types/fund-request";
import { buildFundRequestRejectUpdates } from "@/lib/fund-request-approval";
import {
  FUND_REQUEST_CUTOFF_EXPIRABLE_STATUSES,
  FUND_REQUEST_CUTOFF_EXPIRY_REASON,
  FUND_REQUEST_CUTOFF_EXPIRY_SYSTEM_ACTOR_ID,
  isFundRequestPastCutoffForOmPoExpiry,
} from "@/lib/fund-request-cutoff";

export {
  FUND_REQUEST_CUTOFF_EXPIRY_REASON,
  FUND_REQUEST_CUTOFF_EXPIRY_SYSTEM_ACTOR_ID,
  isFundRequestCutoffExpirySystemActor,
  isFundRequestCutoffExpiryRejection,
} from "@/lib/fund-request-cutoff";

export function buildFundRequestCutoffExpiryUpdates(
  request: FundRequestRow
): Record<string, unknown> | null {
  if (!isFundRequestPastCutoffForOmPoExpiry(request)) return null;
  const updates = buildFundRequestRejectUpdates(
    FUND_REQUEST_CUTOFF_EXPIRY_SYSTEM_ACTOR_ID,
    FUND_REQUEST_CUTOFF_EXPIRY_REASON,
    request
  );
  // `rejected_by` FK → profiles. System actor is not a real profile, so store null
  // on the row and keep the system id only inside rejection_history JSON.
  return {
    ...updates,
    rejected_by: null,
  };
}

/**
 * Reject OM/PO-stage fund requests whose filing cutoff week has ended.
 * Leaves UM-stage (`purchasing_officer_approved`) untouched.
 */
export async function expirePastCutoffFundRequests(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{ expiredIds: string[]; skipped: number; error?: string }> {
  const { data, error } = await admin
    .from("fund_requests")
    .select("*")
    .in("status", [...FUND_REQUEST_CUTOFF_EXPIRABLE_STATUSES]);

  if (error) {
    return { expiredIds: [], skipped: 0, error: error.message };
  }

  const rows = (data as FundRequestRow[] | null) ?? [];
  const toExpire = rows.filter((row) => isFundRequestPastCutoffForOmPoExpiry(row, now));
  const expiredIds: string[] = [];

  for (const row of toExpire) {
    const updates = buildFundRequestCutoffExpiryUpdates(row);
    if (!updates) continue;

    const { error: updateError } = await admin
      .from("fund_requests")
      .update(updates)
      .eq("id", row.id)
      .in("status", [...FUND_REQUEST_CUTOFF_EXPIRABLE_STATUSES]);

    if (updateError) {
      return {
        expiredIds,
        skipped: toExpire.length - expiredIds.length,
        error: updateError.message,
      };
    }
    expiredIds.push(row.id);
  }

  return {
    expiredIds,
    skipped: rows.length - toExpire.length,
  };
}
