/**
 * Promote PO self-filed fund requests stuck at project_manager_approved to UM queue.
 *
 * Usage:
 *   npx tsx scripts/repair-po-self-submit-fund-requests.ts
 *   npx tsx scripts/repair-po-self-submit-fund-requests.ts --id <fund-request-id>
 *   npx tsx scripts/repair-po-self-submit-fund-requests.ts --dry-run
 */

import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { FundRequestRow } from "../types/fund-request";
import { isFundRequestReturnedToPurchasing } from "../lib/fund-request-approval";
import { normalizeUserRole } from "../lib/user-roles";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

type CandidateRow = FundRequestRow & {
  employees: {
    user_id: string | null;
    email: string | null;
    full_name: string | null;
  } | null;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const singleId = readArg("--id");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from("fund_requests")
    .select(
      "*, employees ( user_id, email, full_name )"
    )
    .eq("status", "project_manager_approved")
    .is("purchasing_officer_approved_by", null)
    .is("purchasing_officer_approved_at", null);

  if (singleId) {
    query = query.eq("id", singleId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const candidates = ((data as CandidateRow[] | null) ?? []).filter((row) => {
    if (isFundRequestReturnedToPurchasing(row)) return false;
    const requesterUserId = row.employees?.user_id;
    if (!requesterUserId) return false;
    return true;
  });

  if (candidates.length === 0) {
    console.log("No stuck PO self-submit fund requests found.");
    return;
  }

  const profileIds = [
    ...new Set(
      candidates
        .map((row) => row.employees?.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .in("id", profileIds);

  if (profileError) throw profileError;

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  let repaired = 0;

  for (const row of candidates) {
    const requesterUserId = row.employees?.user_id;
    if (!requesterUserId) continue;

    const profile = profileById.get(requesterUserId);
    if (!profile || normalizeUserRole(profile.role) !== "purchasing_officer") {
      continue;
    }

    const stamp = row.created_at ?? new Date().toISOString();
    console.log(
      `${dryRun ? "[dry-run] " : ""}Repair ${row.id} (${row.purpose}, ₱${row.total_requested_amount}) for ${profile.full_name ?? requesterUserId}`
    );

    if (dryRun) {
      repaired += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("fund_requests")
      .update({
        status: "purchasing_officer_approved",
        purchasing_officer_approved_by: requesterUserId,
        purchasing_officer_approved_at: stamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "project_manager_approved");

    if (updateError) throw updateError;
    repaired += 1;
  }

  console.log(`${dryRun ? "Would repair" : "Repaired"} ${repaired} fund request(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
