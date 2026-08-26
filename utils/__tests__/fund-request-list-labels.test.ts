import { describe, expect, it } from "vitest";
import {
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
    project_id: null,
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
  it("prefers project location over title", () => {
    expect(getFundRequestListProjectLabel(baseRequest())).toBe("BGC Site 2");
  });

  it("falls back to title when location is empty", () => {
    expect(
      getFundRequestListProjectLabel(
        baseRequest({ project_location: "", project_title: "Tower 3" })
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

describe("summarizeFundRequestPayment label", () => {
  it("leads with area and subcontractor name", () => {
    const summary = summarizeFundRequestPayment({
      ...baseRequest({
        vendors: { name: "Acme Builders Inc" },
      }),
      employees: null,
      vendors: { name: "Acme Builders Inc" },
      projects: null,
    });
    expect(summary.label).toContain("BGC Site 2");
    expect(summary.label).toContain("Acme Builders Inc");
    expect(summary.label).not.toContain("Subcontractor Payment");
    expect(summary.label).not.toContain("Building A Fit-out");
  });
});
