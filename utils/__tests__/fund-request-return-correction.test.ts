import { describe, expect, it } from "vitest";
import { buildFundRequestApprovalUpdates } from "@/lib/fund-request-approval";
import {
  applyFundRequestReturnResubmit,
  buildFundRequestReturnCorrection,
  diffFundRequestReturnCorrections,
  formatFundRequestReturnReason,
  validateFundRequestReturnCorrection,
} from "@/lib/fund-request-return-correction";
import type { FundRequestRow } from "@/types/fund-request";

function baseRequest(
  overrides: Partial<FundRequestRow> = {}
): FundRequestRow {
  return {
    id: "req-1",
    company_id: "company",
    project_id: null,
    requested_by: "employee",
    request_date: "2026-07-01",
    purpose: "Materials",
    reference_mode: "client_linked",
    po_number: "PO-1",
    vendor_id: null,
    vendor_po_number: null,
    project_title: "Site A",
    project_location: "Laguna",
    project_details: null,
    po_amount: 100000,
    po_amount_percentage: null,
    current_project_percentage: 40,
    subcontractor_progress_completion_percentage: null,
    subcontractor_po_amount: null,
    details: null,
    total_requested_amount: 100000,
    date_needed: "2026-07-10",
    remarks: null,
    urgent_reason: null,
    status: "purchasing_officer_approved",
    project_manager_approved_by: null,
    project_manager_approved_at: null,
    purchasing_officer_approved_by: "po-1",
    purchasing_officer_approved_at: "2026-07-03T02:00:00+08:00",
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
    rejection_history: [],
    rejection_undo_snapshot: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-03T02:00:00Z",
    ...overrides,
  };
}

describe("fund request return correction", () => {
  it("requires selected form fields or Others with a typed reason", () => {
    expect(
      validateFundRequestReturnCorrection({ fields: [], otherReason: "" })
    ).toEqual({
      ok: false,
      message:
        "Select the form values to correct, or choose Others and type a reason.",
    });
    expect(
      validateFundRequestReturnCorrection({
        fields: ["others"],
        otherReason: "",
      })
    ).toEqual({
      ok: false,
      message: "Type the reason for Others.",
    });
    expect(
      validateFundRequestReturnCorrection({
        fields: ["totalRequested"],
        otherReason: "",
      })
    ).toEqual({ ok: true });
    expect(
      validateFundRequestReturnCorrection({
        fields: ["others"],
        otherReason: "Please attach the delivery receipt.",
      })
    ).toEqual({ ok: true });
  });

  it("formats a human-readable return reason from selected fields", () => {
    expect(
      formatFundRequestReturnReason({
        fields: ["totalRequested", "poAmount"],
        otherReason: "",
      })
    ).toBe("Correct: Total Requested Amount, P.O. Amount");
    expect(
      formatFundRequestReturnReason({
        fields: ["others"],
        otherReason: "Wrong supporting document",
      })
    ).toBe("Wrong supporting document");
  });

  it("snapshots selected values and diffs amount changes after PO resubmit", () => {
    const request = baseRequest();
    const correction = buildFundRequestReturnCorrection(
      { fields: ["totalRequested"], otherReason: "" },
      request
    );
    expect(correction.snapshot.totalRequested).toBe("₱100,000.00");
    expect(correction.fields).toEqual(["totalRequested"]);

    const diffs = diffFundRequestReturnCorrections(correction, {
      ...request,
      total_requested_amount: 150000,
    });
    expect(diffs.totalRequested).toEqual({
      from: "₱100,000.00",
      to: "₱150,000.00",
    });
  });

  it("does not highlight Others-only returns", () => {
    const correction = buildFundRequestReturnCorrection(
      { fields: ["others"], otherReason: "Please print on BPI stock." },
      baseRequest()
    );
    expect(correction.fields).toEqual(["others"]);
    expect(
      diffFundRequestReturnCorrections(correction, {
        ...baseRequest(),
        total_requested_amount: 150000,
      })
    ).toEqual({});
  });

  it("attaches green diffs when purchasing resubmits a returned request", () => {
    const request = baseRequest({
      status: "project_manager_approved",
      purchasing_officer_approved_at: null,
      purchasing_officer_approved_by: null,
    });
    const correction = buildFundRequestReturnCorrection(
      { fields: ["totalRequested"], otherReason: "" },
      request
    );
    const resubmitted = applyFundRequestReturnResubmit(
      correction,
      { ...request, total_requested_amount: 150000 },
      "2026-07-08T04:00:00.000Z"
    );
    expect(resubmitted?.corrections?.totalRequested).toEqual({
      from: "₱100,000.00",
      to: "₱150,000.00",
    });

    const updates = buildFundRequestApprovalUpdates(
      "project_manager_approved",
      "po-1",
      {
        returnCorrection: correction,
        returnSnapshotSource: {
          ...request,
          total_requested_amount: 150000,
        },
      }
    );
    expect(updates?.status).toBe("purchasing_officer_approved");
    expect(updates?.return_correction).toEqual(
      expect.objectContaining({
        corrections: {
          totalRequested: { from: "₱100,000.00", to: "₱150,000.00" },
        },
      })
    );
  });
});
