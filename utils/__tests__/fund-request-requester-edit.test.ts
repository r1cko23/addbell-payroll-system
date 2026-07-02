import {
  canRequesterEditFundRequest,
  isPurchasingOfficerSelfSubmitAwaitingUpperManagement,
} from "@/lib/fund-request-approval";
import type { FundRequestRow } from "@/types/fund-request";

function omRequestAfterPoApproval(): FundRequestRow {
  return {
    id: "test",
    company_id: "company",
    project_id: null,
    requested_by: "joel-employee",
    request_date: "2026-07-01",
    purpose: "Pcash",
    reference_mode: "internal_stock",
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
    total_requested_amount: 80000,
    date_needed: null,
    remarks: null,
    urgent_reason: null,
    status: "purchasing_officer_approved",
    project_manager_approved_by: null,
    project_manager_approved_at: null,
    purchasing_officer_approved_by: "phen-user",
    purchasing_officer_approved_at: "2026-07-01T10:00:00Z",
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
  };
}

describe("canRequesterEditFundRequest", () => {
  test("blocks OM requester after purchasing officer approved for UM", () => {
    const request = omRequestAfterPoApproval();
    expect(
      canRequesterEditFundRequest(request, { requesterUserId: "joel-user" })
    ).toBe(false);
  });

  test("still allows edit while waiting on purchasing officer", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      status: "project_manager_approved" as const,
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
    };
    expect(
      canRequesterEditFundRequest(request, { requesterUserId: "joel-user" })
    ).toBe(true);
  });

  test("allows PO self-submit edit while waiting on upper management", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      purchasing_officer_approved_by: "phen-user",
    };
    expect(
      isPurchasingOfficerSelfSubmitAwaitingUpperManagement(request, "phen-user")
    ).toBe(true);
    expect(
      canRequesterEditFundRequest(request, { requesterUserId: "phen-user" })
    ).toBe(true);
  });
});
