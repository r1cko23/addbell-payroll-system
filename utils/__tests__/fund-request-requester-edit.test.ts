import {
  canRequesterAddDocumentToFundRequest,
  canRequesterEditFundRequest,
  canRequesterUpdateFundRequestPoNumber,
  isPurchasingOfficerSelfSubmitAwaitingUpperManagement,
} from "@/lib/fund-request-approval";
import {
  buildFundRequestPoNumberColumnUpdates,
  canRequesterCorrectFundRequestPoNumber,
} from "@/lib/fund-request-requester-edit";
import { canPurchasingOfficerSetVatEwtOnRequesterForm } from "@/lib/fund-request-details";
import type { FundRequestRow } from "@/types/fund-request";

function omRequestAfterPoApproval(): FundRequestRow {
  return {
    id: "test",
    company_id: "company",
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
    return_correction: null,
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

  test("allows OM requester to edit while waiting on purchasing officer", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      status: "project_manager_approved" as const,
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
    };
    expect(
      canRequesterEditFundRequest(request, {
        requesterUserId: "joel-user",
        requesterIsOperationsManager: true,
      })
    ).toBe(true);
  });

  test("still allows non-OM requester edit while waiting on purchasing officer", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      status: "project_manager_approved" as const,
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      requested_by: "employee-not-under-om",
    };
    expect(
      canRequesterEditFundRequest(request, { requesterIsOperationsManager: false })
    ).toBe(true);
  });

  test("blocks employee under OM once operations manager approved", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      status: "project_manager_approved" as const,
      project_manager_approved_by: "constantino-user",
      project_manager_approved_at: "2026-07-01T09:00:00Z",
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      requested_by: "eleazar-employee",
    };
    expect(canRequesterEditFundRequest(request)).toBe(false);
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

  test("PO self-submit awaiting UM is the status where requester form shows VAT/EWT", () => {
    expect(
      canPurchasingOfficerSetVatEwtOnRequesterForm({
        role: "purchasing_officer",
        isSelfSubmitPath: true,
        isEditMode: true,
        editStatus: "purchasing_officer_approved",
      })
    ).toBe(true);
  });
});

describe("canRequesterAddDocumentToFundRequest", () => {
  test("allows OM requester to add documents while waiting on purchasing officer", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      status: "project_manager_approved" as const,
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
    };
    expect(
      canRequesterAddDocumentToFundRequest(request, {
        requesterUserId: "joel-user",
        requesterIsOperationsManager: true,
      })
    ).toBe(true);
    expect(
      canRequesterEditFundRequest(request, {
        requesterUserId: "joel-user",
        requesterIsOperationsManager: true,
      })
    ).toBe(true);
  });

  test("blocks OM document upload after purchasing officer approved", () => {
    const request = omRequestAfterPoApproval();
    expect(
      canRequesterAddDocumentToFundRequest(request, {
        requesterUserId: "joel-user",
        requesterIsOperationsManager: true,
      })
    ).toBe(false);
  });
});

describe("canRequesterUpdateFundRequestPoNumber", () => {
  test("allows PO correction after later approval (NTP until Projects masterlist)", () => {
    const request = omRequestAfterPoApproval();
    expect(canRequesterUpdateFundRequestPoNumber(request)).toBe(true);
    expect(
      canRequesterCorrectFundRequestPoNumber(request, "joel-employee")
    ).toBe(true);
  });

  test("blocks PO correction on rejected requests", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      status: "rejected" as const,
      rejected_at: "2026-07-02T00:00:00Z",
    };
    expect(canRequesterUpdateFundRequestPoNumber(request)).toBe(false);
    expect(
      canRequesterCorrectFundRequestPoNumber(request, "joel-employee")
    ).toBe(false);
  });

  test("replaces NTP placeholder on primary project when correcting PO", () => {
    const request = {
      ...omRequestAfterPoApproval(),
      po_number: "With NTP only",
      project_details: {
        v: 1 as const,
        projects: [
          {
            po_number: "With NTP only",
            title: "Civil works",
            location: "Site",
            po_amount: 1000,
            completion_percentage: 10,
          },
        ],
      },
    };
    const next = buildFundRequestPoNumberColumnUpdates(request, "PO-RE1350007690");
    expect(next.po_number).toBe("PO-RE1350007690");
    expect(next.project_details?.projects[0]?.po_number).toBe("PO-RE1350007690");
  });
});
