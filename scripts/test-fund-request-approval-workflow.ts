/**
 * End-to-end fund request approval routing test for operations groups.
 *
 * Verifies: Requester -> OM -> Purchasing Officer -> Upper Management
 * Creates a test request per requester, walks the full chain, then deletes it.
 *
 * Usage: npx tsx scripts/test-fund-request-approval-workflow.ts
 */

import path from "path";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildFundRequestApprovalUpdates,
  canActOnFundRequest,
} from "../lib/fund-request-approval";
import {
  canOperationsManagerActOnFundRequest,
  getFundRequestSubmissionWorkflow,
  resolveFundRequestRequesterRouting,
} from "../lib/fund-request-routing";
import { fetchManagedEmployeeIdsForApprover } from "../lib/manager-approval-queue";
import type { FundRequestRow } from "../types/fund-request";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

type TestCase = {
  label: string;
  employeeId: string;
  expectedGroupName: string;
  expectedOmUserId: string;
  expectedOmName: string;
};

const PURCHASING_OFFICER_USER_ID = "b7069605-1126-448b-b96f-f944e86e8e13"; // Phen Conte
const UPPER_MANAGEMENT_USER_ID = "885b9e15-6a64-4345-925d-6ed5d98dc419"; // Dado Leonardo

const TEST_CASES: TestCase[] = [
  {
    label: "Eleazar Conte",
    employeeId: "eb95ec6d-c8e7-4adb-8208-a4b1eb7f6abe",
    expectedGroupName: "Operations-Laguna",
    expectedOmUserId: "bf70e9c8-aa43-4468-878f-1cddc90d12f6",
    expectedOmName: "Constantino Milo",
  },
  {
    label: "Julio Mallari",
    employeeId: "5598986d-e165-4dbe-85df-262af49fc28a",
    expectedGroupName: "Operations-Manila II",
    expectedOmUserId: "4ed5c668-bef6-4373-8e9f-1af55ef10f09",
    expectedOmName: "Carizza Leonardo",
  },
  {
    label: "Daniel Tabada",
    employeeId: "f0db2c9c-05ca-43ac-a5f6-0191e3fdb1d7",
    expectedGroupName: "Operations-Manila I",
    expectedOmUserId: "bc93a339-6a61-45fe-98d8-b51bf16cd889",
    expectedOmName: "Joel Mallari",
  },
  {
    label: "Rechel Cayabat",
    employeeId: "9b1feda7-1095-4159-9a85-fc90cc026d0c",
    expectedGroupName: "Operations-Manila II",
    expectedOmUserId: "4ed5c668-bef6-4373-8e9f-1af55ef10f09",
    expectedOmName: "Carizza Leonardo",
  },
];

const WORKFLOW_STATUSES: FundRequestRow["status"][] = [
  "pending",
  "project_manager_approved",
  "purchasing_officer_approved",
  "management_approved",
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadRequest(
  supabase: SupabaseClient,
  requestId: string
): Promise<FundRequestRow> {
  const { data, error } = await supabase
    .from("fund_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || `Request ${requestId} not found`);
  }

  return data as FundRequestRow;
}

async function createTestRequest(
  supabase: SupabaseClient,
  requestedBy: string
): Promise<string> {
  const routing = await resolveFundRequestRequesterRouting(supabase, requestedBy);
  const workflow = getFundRequestSubmissionWorkflow({
    submitterRole: null,
    isPortal: true,
    submitterUserId: null,
    requiresOperationsManagerApproval: routing.requiresOperationsManagerApproval,
  });

  assert(
    workflow.status === "pending",
    `Expected initial status pending, got ${workflow.status}`
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("fund_requests")
    .insert({
      company_id: null,
      project_id: null,
      requested_by: requestedBy,
      request_date: today,
      purpose: "Material Purchase",
      reference_mode: "internal_stock",
      po_number: null,
      project_title: null,
      project_location: null,
      vendor_id: null,
      vendor_po_number: null,
      po_amount: null,
      po_amount_percentage: null,
      current_project_percentage: null,
      subcontractor_progress_completion_percentage: null,
      subcontractor_po_amount: null,
      project_details: null,
      details: [{ description: "ROUTING TEST — safe to delete", amount: 1 }],
      total_requested_amount: 1,
      date_needed: today,
      remarks: "Automated approval workflow test",
      urgent_reason: null,
      status: workflow.status,
      project_manager_approved_by: workflow.project_manager_approved_by,
      project_manager_approved_at: workflow.project_manager_approved_at,
      purchasing_officer_approved_by: workflow.purchasing_officer_approved_by,
      purchasing_officer_approved_at: workflow.purchasing_officer_approved_at,
      management_approved_by: workflow.management_approved_by,
      management_approved_at: workflow.management_approved_at,
      supplier_bank_details: null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create test fund request");
  }

  return data.id;
}

async function approveAs(
  supabase: SupabaseClient,
  requestId: string,
  currentStatus: FundRequestRow["status"],
  approverUserId: string
): Promise<FundRequestRow["status"]> {
  const updates = buildFundRequestApprovalUpdates(currentStatus, approverUserId);
  assert(Boolean(updates), `No approval updates for status ${currentStatus}`);

  const { error } = await supabase
    .from("fund_requests")
    .update(updates as never)
    .eq("id", requestId);

  if (error) {
    throw new Error(`Approval failed at ${currentStatus}: ${error.message}`);
  }

  return updates!.status as FundRequestRow["status"];
}

async function deleteTestRequest(
  supabase: SupabaseClient,
  requestId: string
): Promise<void> {
  const { error } = await supabase.from("fund_requests").delete().eq("id", requestId);
  if (error) {
    throw new Error(`Failed to delete test request ${requestId}: ${error.message}`);
  }
}

async function runCase(supabase: SupabaseClient, testCase: TestCase): Promise<void> {
  console.log(`\n=== ${testCase.label} (${testCase.expectedGroupName}) ===`);

  const routing = await resolveFundRequestRequesterRouting(
    supabase,
    testCase.employeeId
  );

  assert(
    routing.requiresOperationsManagerApproval,
    `${testCase.label}: expected OM approval required`
  );
  assert(
    routing.overtimeGroupName === testCase.expectedGroupName,
    `${testCase.label}: expected group ${testCase.expectedGroupName}, got ${routing.overtimeGroupName}`
  );
  assert(
    routing.groupApproverUserId === testCase.expectedOmUserId,
    `${testCase.label}: expected OM ${testCase.expectedOmName}, got approver ${routing.groupApproverUserId}`
  );

  const managedIds = await fetchManagedEmployeeIdsForApprover(
    supabase,
    testCase.expectedOmUserId
  );
  assert(
    managedIds.includes(testCase.employeeId),
    `${testCase.label}: OM ${testCase.expectedOmName} should manage this requester`
  );

  const requestId = await createTestRequest(supabase, testCase.employeeId);
  console.log(`  Created test request: ${requestId}`);

  try {
    let request = await loadRequest(supabase, requestId);
    assert(request.status === "pending", `Expected pending, got ${request.status}`);

    assert(
      canOperationsManagerActOnFundRequest(request, managedIds),
      `${testCase.label}: OM should be able to act while pending`
    );
    assert(
      canActOnFundRequest("operations_manager", request.status, {
        request,
        managedRequesterIds: managedIds,
      }),
      `${testCase.label}: canActOnFundRequest should allow OM`
    );
    assert(
      !canActOnFundRequest("purchasing_officer", request.status),
      `${testCase.label}: PO should not act while pending`
    );

    // OM approval
    const afterOm = await approveAs(
      supabase,
      requestId,
      "pending",
      testCase.expectedOmUserId
    );
    assert(afterOm === "project_manager_approved", `After OM: expected PO queue, got ${afterOm}`);
    request = await loadRequest(supabase, requestId);
    assert(
      request.project_manager_approved_by === testCase.expectedOmUserId,
      `${testCase.label}: OM approver id mismatch`
    );
    console.log(`  ✓ OM (${testCase.expectedOmName}) approved`);

    assert(
      canActOnFundRequest("purchasing_officer", request.status),
      `${testCase.label}: PO should act after OM`
    );

    // PO approval
    const afterPo = await approveAs(
      supabase,
      requestId,
      "project_manager_approved",
      PURCHASING_OFFICER_USER_ID
    );
    assert(
      afterPo === "purchasing_officer_approved",
      `After PO: expected upper mgmt queue, got ${afterPo}`
    );
    request = await loadRequest(supabase, requestId);
    assert(
      request.purchasing_officer_approved_by === PURCHASING_OFFICER_USER_ID,
      `${testCase.label}: PO approver id mismatch`
    );
    console.log("  ✓ Purchasing Officer (Phen Conte) approved");

    assert(
      canActOnFundRequest("upper_management", request.status),
      `${testCase.label}: upper management should act after PO`
    );

    // Upper management approval
    const afterUm = await approveAs(
      supabase,
      requestId,
      "purchasing_officer_approved",
      UPPER_MANAGEMENT_USER_ID
    );
    assert(afterUm === "management_approved", `After UM: expected final, got ${afterUm}`);
    request = await loadRequest(supabase, requestId);
    assert(
      request.management_approved_by === UPPER_MANAGEMENT_USER_ID,
      `${testCase.label}: upper management approver id mismatch`
    );
    console.log("  ✓ Upper Management (Dado Leonardo) approved");

    const observed = [
      "pending",
      "project_manager_approved",
      "purchasing_officer_approved",
      "management_approved",
    ] as const;
    assert(
      observed.every((status) => WORKFLOW_STATUSES.includes(status)),
      `${testCase.label}: workflow chain incomplete`
    );

    console.log(`  ✓ Full workflow verified: ${observed.join(" -> ")}`);
  } finally {
    await deleteTestRequest(supabase, requestId);
    console.log(`  Deleted test request: ${requestId}`);
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Fund request approval workflow test");
  console.log("Chain: Requester -> OM -> Purchasing Officer -> Upper Management");

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    try {
      await runCase(supabase, testCase);
      passed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `  ✗ FAILED: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
