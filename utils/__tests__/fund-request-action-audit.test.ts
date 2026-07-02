import { describe, expect, it } from "vitest";
import {
  getFundRequestDispositionLabel,
  isLikelyMislabeledReturnAsRejection,
} from "@/lib/fund-request-action-audit";
import { buildFundRequestUpperManagementReturnUpdates } from "@/lib/fund-request-approval";
import type { FundRequestRow } from "@/types/fund-request";

function baseRequest(
  overrides: Partial<FundRequestRow> = {}
): FundRequestRow {
  return {
    id: "test-id",
    company_id: "company",
    project_id: null,
    requested_by: "employee",
    request_date: "2026-07-01",
    purpose: "Subcontractor Payment",
    reference_mode: "client_linked",
    po_number: null,
    vendor_id: null,
    vendor_po_number: null,
    project_title: null,
    project_location: null,
    project_details: null,
    po_amount: null,
    po_amount_percentage: null,
    current_project_percentage: null,
    subcontractor_progress_completion_percentage: null,
    subcontractor_po_amount: null,
    details: null,
    total_requested_amount: 1000,
    date_needed: null,
    remarks: null,
    urgent_reason: null,
    status: "purchasing_officer_approved",
    project_manager_approved_by: null,
    project_manager_approved_at: null,
    purchasing_officer_approved_by: null,
    purchasing_officer_approved_at: null,
    management_approved_by: null,
    management_approved_at: null,
    supplier_bank_details: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    returned_by: null,
    returned_at: null,
    return_reason: null,
    rejection_undo_snapshot: null,
    rejection_history: [],
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("fund request action audit", () => {
  it("flags mislabeled UM returns that were normalized to rejected", () => {
    const request = baseRequest({
      status: "rejected",
      rejected_by: "um-user",
      rejected_at: "2026-07-02T02:47:28.828+00:00",
      rejection_reason:
        "SYSTEM TO BE FIXED FIRST. INPUT SUBCON P.O. AMOUNT. WILL BE APPROVED LATER.",
      rejection_undo_snapshot: {
        status: "purchasing_officer_approved",
        purchasing_officer_approved_by: "po-user",
        purchasing_officer_approved_at: "2026-07-01T12:00:00Z",
        supplier_bank_details: null,
        management_approved_by: null,
        management_approved_at: null,
      },
    });

    expect(isLikelyMislabeledReturnAsRejection(request)).toBe(true);
    expect(getFundRequestDispositionLabel(request)).toBe(
      "Returned to Purchasing (mislabeled as rejected)"
    );
  });

  it("records UM return separately from rejection fields", () => {
    const request = baseRequest({
      rejection_history: [],
    });
    const updates = buildFundRequestUpperManagementReturnUpdates(
      "um-user",
      "Fix subcontract P.O. amount",
      {
        status: "purchasing_officer_approved",
        purchasing_officer_approved_by: "po-user",
        purchasing_officer_approved_at: "2026-07-01T12:00:00Z",
        supplier_bank_details: null,
        management_approved_by: null,
        management_approved_at: null,
      },
      request,
      { returnToOperationsManager: false }
    );

    expect(updates.status).toBe("project_manager_approved");
    expect(updates.returned_by).toBe("um-user");
    expect(updates.return_reason).toBe("Fix subcontract P.O. amount");
    expect(updates.rejected_by).toBeNull();
    expect(updates.rejected_at).toBeNull();
    expect(updates.rejection_history).toEqual([
      expect.objectContaining({
        action: "return_to_purchasing",
        rejected_by: "um-user",
        rejection_reason: "Fix subcontract P.O. amount",
      }),
    ]);
  });
});
