import { describe, expect, it } from "vitest";
import {
  formatFundRequestReferenceSummaryLabel,
  getFundRequestListProjectLabel,
  getFundRequestListPurposeLabel,
} from "@/lib/fund-request-project-details";
import { summarizeFundRequestPayment } from "@/lib/fund-request-inbox-grouping";
import type { FundRequestRow } from "@/types/fund-request";

function baseRequest(
  overrides: Partial<FundRequestRow> & {
    vendors?: { name?: string | null } | null;
  } = {}
): FundRequestRow & { vendors?: { name?: string | null } | null } {
  return {
    id: "req-1",
    company_id: "company",
    requested_by: "employee-1",
    request_date: "2026-08-24",
    purpose: "Subcontractor Payment",
    reference_mode: "client_linked",
    po_number: null,
    vendor_id: null,
    vendor_po_number: null,
    project_title: "Building A Fit-out",
    project_location: "BGC Site 2",
    project_details: null,
    po_amount: null,
    po_amount_percentage: null,
    current_project_percentage: null,
    subcontractor_progress_completion_percentage: null,
    subcontractor_po_amount: null,
    details: null,
    total_requested_amount: 313794.64,
    date_needed: null,
    remarks: null,
    urgent_reason: null,
    supplier_bank_details: null,
    status: "pending",
    project_manager_approved_by: null,
    project_manager_approved_at: null,
    purchasing_officer_approved_by: null,
    purchasing_officer_approved_at: null,
    management_approved_by: null,
    management_approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    returned_by: null,
    returned_at: null,
    return_reason: null,
    return_correction: null,
    rejection_history: null,
    rejection_undo_snapshot: null,
    created_at: "2026-08-24T02:00:00+08:00",
    updated_at: "2026-08-24T02:00:00+08:00",
    ...overrides,
  };
}

describe("getFundRequestListProjectLabel", () => {
  it("formats as PO | Title | Location for all purposes", () => {
    expect(
      getFundRequestListProjectLabel(
        baseRequest({
          purpose: "Subcontractor Payment",
          po_number: "PO-12345",
        })
      )
    ).toBe("PO-12345 | Building A Fit-out | BGC Site 2");
  });

  it("formats material purchase the same way", () => {
    expect(
      getFundRequestListProjectLabel(
        baseRequest({
          purpose: "Material Purchase",
          project_title: "MALATE FITOUT",
          project_location: "MALATE MANILA",
          po_number: "150006477",
        })
      )
    ).toBe("150006477 | MALATE FITOUT | MALATE MANILA");
  });

  it("omits empty parts", () => {
    expect(
      getFundRequestListProjectLabel(
        baseRequest({
          purpose: "Material Purchase",
          project_location: "",
          project_title: "Tower 3",
          po_number: null,
        })
      )
    ).toBe("Tower 3");
  });
});

describe("getFundRequestListPurposeLabel", () => {
  it("uses the subcontractor name instead of Subcontractor Payment", () => {
    expect(
      getFundRequestListPurposeLabel(
        baseRequest({
          vendors: { name: "South Reliance Home Furnishing Supplies Trading" },
        })
      )
    ).toBe("South Reliance Home Furnishing Supplies Trading");
  });

  it("keeps other purposes unchanged", () => {
    expect(
      getFundRequestListPurposeLabel(baseRequest({ purpose: "Material Purchase" }))
    ).toBe("Material Purchase");
  });
});

describe("formatFundRequestReferenceSummaryLabel", () => {
  it("formats as PO | Title | Location | Purpose (subcon name)", () => {
    expect(
      formatFundRequestReferenceSummaryLabel(
        baseRequest({
          po_number: "PO-999",
          vendors: { name: "Acme Builders Inc" },
        })
      )
    ).toBe("PO-999 | Building A Fit-out | BGC Site 2 | Acme Builders Inc");
  });

  it("formats material purchase as PO | Title | Location | Purpose", () => {
    expect(
      formatFundRequestReferenceSummaryLabel(
        baseRequest({
          purpose: "Material Purchase",
          project_title: "MALATE FITOUT",
          project_location: "MALATE MANILA",
          po_number: "150006477",
        })
      )
    ).toBe("150006477 | MALATE FITOUT | MALATE MANILA | Material Purchase");
  });
});

describe("summarizeFundRequestPayment label", () => {
  it("uses the shared reference summary with | separator", () => {
    const summary = summarizeFundRequestPayment({
      ...baseRequest({
        po_number: "PO-999",
        vendors: { name: "Acme Builders Inc" },
      }),
      employees: null,
      vendors: { name: "Acme Builders Inc" },
      projects: null,
    });
    expect(summary.label).toBe(
      "PO-999 | Building A Fit-out | BGC Site 2 | Acme Builders Inc"
    );
  });
});
