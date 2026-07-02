/**
 * Repair fund requests that were UM "return to purchasing" but later marked rejected.
 *
 * Usage:
 *   npx tsx scripts/repair-mislabeled-fund-request-returns.ts
 *   npx tsx scripts/repair-mislabeled-fund-request-returns.ts --apply
 *   npx tsx scripts/repair-mislabeled-fund-request-returns.ts --apply --id <uuid>
 */

import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { FundRequestRow } from "../types/fund-request";
import { isLikelyMislabeledReturnAsRejection } from "../lib/fund-request-action-audit";
import { appendFundRequestActionHistory } from "../lib/fund-request-rejection-history";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const singleId = readArg("--id");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from("fund_requests")
    .select("*")
    .eq("status", "rejected")
    .order("created_at", { ascending: false });

  if (singleId) {
    query = query.eq("id", singleId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const candidates = ((data ?? []) as FundRequestRow[]).filter((row) =>
    isLikelyMislabeledReturnAsRejection(row)
  );

  console.log(`Found ${candidates.length} mislabeled return(s).`);
  if (candidates.length === 0) return;

  for (const row of candidates) {
    console.log(`\n${row.id}`);
    console.log(`  purpose: ${row.purpose}`);
    console.log(`  rejected_by: ${row.rejected_by}`);
    console.log(`  rejected_at: ${row.rejected_at}`);
    console.log(`  reason: ${row.rejection_reason}`);

    if (!apply) continue;

    const actedAt = row.rejected_at ?? new Date().toISOString();
    const actorId = row.rejected_by;
    if (!actorId) {
      console.log("  Skipped: missing rejected_by");
      continue;
    }

    const { error: updateError } = await supabase
      .from("fund_requests")
      .update({
        status: "project_manager_approved",
        returned_by: actorId,
        returned_at: actedAt,
        return_reason: row.rejection_reason,
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
        rejection_history: appendFundRequestActionHistory(row.rejection_history, {
          action: "return_to_purchasing",
          actorId,
          actedAt,
          reason: row.rejection_reason,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error(`  Failed: ${updateError.message}`);
      continue;
    }

    console.log("  Repaired -> project_manager_approved (return to PO)");
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to repair.");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
