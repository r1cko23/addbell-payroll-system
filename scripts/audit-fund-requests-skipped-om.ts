/**
 * Find fund requests that should have required OM approval but skipped it.
 *
 * Buckets:
 * - active: still in PO/Upper Mgmt queue, not rejected — can be reset with --fix
 * - rejected: skipped OM then rejected (informational; use --fix-rejected to reopen)
 * - approved: reached management_approved without OM (historical audit only)
 *
 * Usage:
 *   npx tsx scripts/audit-fund-requests-skipped-om.ts
 *   npx tsx scripts/audit-fund-requests-skipped-om.ts --fix
 *   npx tsx scripts/audit-fund-requests-skipped-om.ts --fix-rejected
 */

import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { isLikelyMislabeledReturnAsRejection } from "../lib/fund-request-action-audit";
import { resolveFundRequestRequesterRouting } from "../lib/fund-request-routing";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

type SkippedOmRequest = {
  id: string;
  status: string;
  purpose: string;
  request_date: string;
  created_at: string;
  total_requested_amount: number;
  requesterName: string;
  requesterEmployeeId: string;
  groupName: string | null;
  omName: string | null;
  omUserId: string | null;
  purchasingOfficerApprovedBy: string | null;
  rejectedAt: string | null;
};

async function loadSkippedOmRequests(): Promise<{
  active: SkippedOmRequest[];
  rejected: SkippedOmRequest[];
  approved: SkippedOmRequest[];
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables in .env.local");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: requests, error } = await supabase
    .from("fund_requests")
    .select(
      "id, status, purpose, request_date, created_at, total_requested_amount, requested_by, project_manager_approved_by, purchasing_officer_approved_by, management_approved_by, rejected_at"
    )
    .is("project_manager_approved_by", null)
    .neq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load fund requests: ${error.message}`);
  }

  const employeeIds = [
    ...new Set((requests ?? []).map((r) => r.requested_by).filter(Boolean)),
  ];

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, employee_id")
    .in(
      "id",
      employeeIds.length > 0 ? employeeIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const employeeById = new Map(
    (employees ?? []).map((e) => [e.id, e.full_name || e.employee_id || e.id])
  );

  const profileIds = new Set<string>();
  const candidates: SkippedOmRequest[] = [];

  for (const row of requests ?? []) {
    const routing = await resolveFundRequestRequesterRouting(
      supabase,
      row.requested_by
    );
    if (!routing.requiresOperationsManagerApproval) continue;

    if (routing.groupApproverUserId) profileIds.add(routing.groupApproverUserId);
    if (row.purchasing_officer_approved_by) {
      profileIds.add(row.purchasing_officer_approved_by);
    }

    candidates.push({
      id: row.id,
      status: row.status,
      purpose: row.purpose,
      request_date: row.request_date,
      created_at: row.created_at,
      total_requested_amount: row.total_requested_amount,
      requesterName: employeeById.get(row.requested_by) ?? row.requested_by,
      requesterEmployeeId: row.requested_by,
      groupName: routing.overtimeGroupName,
      omName: null,
      omUserId: routing.groupApproverUserId,
      purchasingOfficerApprovedBy: row.purchasing_officer_approved_by,
      rejectedAt: row.rejected_at,
    });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in(
      "id",
      profileIds.size > 0
        ? [...profileIds]
        : ["00000000-0000-0000-0000-000000000000"]
    );

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name || p.id])
  );

  for (const item of candidates) {
    item.omName = item.omUserId
      ? profileById.get(item.omUserId) ?? item.omUserId
      : null;
  }

  const active: SkippedOmRequest[] = [];
  const rejected: SkippedOmRequest[] = [];
  const approved: SkippedOmRequest[] = [];

  for (const item of candidates) {
    if (item.status === "management_approved") {
      approved.push(item);
    } else if (item.rejectedAt) {
      rejected.push(item);
    } else if (
      item.status === "project_manager_approved" ||
      item.status === "purchasing_officer_approved"
    ) {
      active.push(item);
    }
  }

  return { active, rejected, approved };
}

function printRequest(
  row: SkippedOmRequest,
  profileById: Map<string, string>
): void {
  const poApprover = row.purchasingOfficerApprovedBy
    ? profileById.get(row.purchasingOfficerApprovedBy) ??
      row.purchasingOfficerApprovedBy
    : "—";
  console.log(`ID: ${row.id}`);
  console.log(`  Requester: ${row.requesterName}`);
  console.log(`  Group: ${row.groupName ?? "—"}`);
  console.log(`  OM: ${row.omName ?? "—"}`);
  console.log(`  Purpose: ${row.purpose}`);
  console.log(`  Amount: ${row.total_requested_amount}`);
  console.log(`  Request date: ${row.request_date}`);
  console.log(`  Created: ${row.created_at}`);
  console.log(`  Current status: ${row.status}`);
  if (row.rejectedAt) {
    console.log(`  Rejected at: ${row.rejectedAt}`);
  }
  if (row.status === "purchasing_officer_approved" && !row.rejectedAt) {
    console.log(`  PO approved by: ${poApprover}`);
  }
  console.log("");
}

async function resetToPending(
  ids: string[],
  rows: SkippedOmRequest[],
  clearRejection: boolean
): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let fixed = 0;
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    const { error: updateError } = await supabase
      .from("fund_requests")
      .update({
        status: "pending",
        project_manager_approved_by: null,
        project_manager_approved_at: null,
        purchasing_officer_approved_by: null,
        purchasing_officer_approved_at: null,
        management_approved_by: null,
        management_approved_at: null,
        ...(clearRejection
          ? {
              rejected_at: null,
              rejected_by: null,
              rejection_reason: null,
              rejection_undo_snapshot: null,
            }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("project_manager_approved_by", null);

    if (updateError) {
      console.error(`  Failed ${id}: ${updateError.message}`);
      continue;
    }

    fixed += 1;
    console.log(
      `  Reset ${id} (${row?.requesterName ?? "unknown"}) -> pending for ${row?.omName ?? "OM"}`
    );
  }

  return fixed;
}

async function normalizeLegacyRejectedStatus(): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("fund_requests")
    .select(
      "id, status, requested_by, rejected_at, rejection_undo_snapshot, purchasing_officer_approved_at, rejection_reason, rejection_history"
    )
    .not("rejected_at", "is", null)
    .neq("status", "rejected")
    .neq("status", "management_approved");

  if (error) {
    throw new Error(`Failed to load legacy rejected requests: ${error.message}`);
  }

  let updated = 0;
  for (const row of data ?? []) {
    if (isLikelyMislabeledReturnAsRejection(row)) {
      console.log(
        `  Skipped ${row.id}: rejected_at present but row looks like a UM return, not a final rejection`
      );
      continue;
    }

    const { error: updateError } = await supabase
      .from("fund_requests")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error(`  Failed ${row.id}: ${updateError.message}`);
      continue;
    }
    updated += 1;
    console.log(`  Normalized ${row.id} (${row.status} -> rejected)`);
  }

  return updated;
}

async function main() {
  const fixActive = process.argv.includes("--fix");
  const fixRejected = process.argv.includes("--fix-rejected");
  const normalizeRejected = process.argv.includes("--normalize-rejected-status");

  const { active, rejected, approved } = await loadSkippedOmRequests();

  const profileById = new Map<string, string>();
  for (const row of [...active, ...rejected, ...approved]) {
    if (row.omUserId && row.omName) profileById.set(row.omUserId, row.omName);
    if (row.purchasingOfficerApprovedBy) {
      profileById.set(row.purchasingOfficerApprovedBy, row.purchasingOfficerApprovedBy);
    }
  }

  console.log("Fund requests that skipped OM approval\n");
  console.log(
    "Criteria: OM-led requester, never approved by OM (project_manager_approved_by is null)\n"
  );

  console.log(`ACTIVE in pipeline (not rejected): ${active.length}`);
  if (active.length > 0) {
    console.log("");
    for (const row of active) printRequest(row, profileById);
  }

  console.log(`REJECTED after skipping OM: ${rejected.length}`);
  if (rejected.length > 0) {
    console.log("");
    for (const row of rejected) printRequest(row, profileById);
  }

  console.log(`HISTORICAL (management_approved without OM): ${approved.length}`);
  if (approved.length > 0) {
    console.log("");
    for (const row of approved) printRequest(row, profileById);
  }

  if (!fixActive && !fixRejected && !normalizeRejected) {
    if (active.length > 0) {
      console.log("To reset active requests to OM queue:");
      console.log("  npx tsx scripts/audit-fund-requests-skipped-om.ts --fix");
    }
    if (rejected.length > 0) {
      console.log("To reopen rejected requests at OM queue:");
      console.log("  npx tsx scripts/audit-fund-requests-skipped-om.ts --fix-rejected");
      console.log("To set status=rejected on legacy rows that only have rejected_at:");
      console.log("  npx tsx scripts/audit-fund-requests-skipped-om.ts --normalize-rejected-status");
    }
    return;
  }

  if (normalizeRejected) {
    console.log("Normalizing legacy rejected fund requests...\n");
    const normalized = await normalizeLegacyRejectedStatus();
    console.log(`\nNormalized ${normalized} request(s).`);
    return;
  }

  if (fixActive && active.length > 0) {
    console.log("Resetting active requests to pending...\n");
    const fixed = await resetToPending(
      active.map((r) => r.id),
      active,
      false
    );
    console.log(`\nReset ${fixed} active request(s).`);
  }

  if (fixRejected && rejected.length > 0) {
    console.log("Reopening rejected requests at pending...\n");
    const fixed = await resetToPending(
      rejected.map((r) => r.id),
      rejected,
      true
    );
    console.log(`\nReopened ${fixed} rejected request(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
