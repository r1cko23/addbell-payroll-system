/**
 * Restore a fund request to a prior rejection record.
 *
 * Usage:
 *   npx tsx scripts/repair-fund-request-rejection.ts \
 *     --id 45b30aea-55bd-4aa4-9787-bc71e48a7e3f \
 *     --rejected-by 78d9fa62-0245-4e0b-a24f-bdd292d51f90 \
 *     --rejected-at "2026-07-02T03:15:00+00:00" \
 *     --reason "Optional rejection reason"
 */

import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { FundRequestRow } from "../types/fund-request";
import { buildFundRequestRejectionUndoSnapshot } from "../lib/fund-request-approval";
import { appendFundRequestRejectionHistory } from "../lib/fund-request-rejection-history";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const id = readArg("--id");
  const rejectedBy = readArg("--rejected-by");
  const rejectedAt = readArg("--rejected-at");
  const reason = readArg("--reason");

  if (!id || !rejectedBy || !rejectedAt) {
    throw new Error("Missing required args: --id, --rejected-by, --rejected-at");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("fund_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error(`Fund request not found: ${id}`);
  }

  const request = data as FundRequestRow;
  const snapshot =
    request.rejection_undo_snapshot ??
    buildFundRequestRejectionUndoSnapshot({
      ...request,
      status: "purchasing_officer_approved",
    } as FundRequestRow);

  const history = appendFundRequestRejectionHistory(request.rejection_history, {
    action: "reject",
    rejected_by: rejectedBy,
    rejected_at: rejectedAt,
    rejection_reason: reason,
  });

  const { error: updateError } = await supabase
    .from("fund_requests")
    .update({
      status: "rejected",
      rejected_by: rejectedBy,
      rejected_at: rejectedAt,
      rejection_reason: reason,
      rejection_undo_snapshot: snapshot,
      rejection_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) throw updateError;

  console.log(`Restored rejection for ${id}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
