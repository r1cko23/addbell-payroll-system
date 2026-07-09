import {
  fundRequestBelongsToApproverCutoff,
  fundRequestBelongsToHistoryCutoff,
  getActiveFundRequestCutoffIndex,
  getFundRequestCutoffStartYmd,
  getFundRequestCutoffStartYmdForFiling,
  getFundRequestHistoryCutoffs,
  shouldShowFundRequestCutoffDeadlineTimeForPeriod,
} from "@/lib/fund-request-cutoff";
import type { FundRequestRow } from "@/types/fund-request";

function baseRequest(overrides: Partial<FundRequestRow> = {}): FundRequestRow {
  return {
    id: "req-1",
    company_id: "company",
    project_id: null,
    requested_by: "employee-1",
    request_date: "2026-07-01",
    purpose: "Liquidation",
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
    total_requested_amount: 10000,
    date_needed: null,
    remarks: null,
    urgent_reason: null,
    supplier_bank_details: null,
    status: "management_approved",
    project_manager_approved_by: null,
    project_manager_approved_at: null,
    purchasing_officer_approved_by: "po-1",
    purchasing_officer_approved_at: "2026-07-03T02:00:00+08:00",
    management_approved_by: "um-1",
    management_approved_at: "2026-07-03T04:00:00+08:00",
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    returned_by: null,
    returned_at: null,
    return_reason: null,
    rejection_history: null,
    rejection_undo_snapshot: null,
    created_at: "2026-07-01T06:00:00+08:00",
    updated_at: "2026-07-03T04:00:00+08:00",
    ...overrides,
  };
}

const jun26Cutoff = {
  start_ymd: "2026-06-26",
  end_ymd: "2026-07-02",
  label: "Jun 26 – Jul 2",
};

const jul3Cutoff = {
  start_ymd: "2026-07-03",
  end_ymd: "2026-07-09",
  label: "Jul 3 – Jul 9",
};

describe("getFundRequestCutoffStartYmd", () => {
  it("uses request_date for cutoff week even when approvals happen next week", () => {
    expect(getFundRequestCutoffStartYmd(baseRequest())).toBe("2026-06-26");
  });

  it("keeps Jul 2 recovery-week filings in Jun 26 cutoff after Thu 10 AM when viewed later", () => {
    expect(
      getFundRequestCutoffStartYmdForFiling(
        "2026-07-02T12:00:00+08:00",
        "2026-07-02"
      )
    ).toBe("2026-06-26");
  });

  it("rolls late Thursday filings forward outside exempt weeks", () => {
    expect(
      getFundRequestCutoffStartYmdForFiling(
        "2026-07-16T12:00:00+08:00",
        "2026-07-16"
      )
    ).toBe("2026-07-17");
  });
});

describe("fundRequestBelongsToApproverCutoff", () => {
  it("keeps a Jul 1 filing in Jun 26 cutoff when PO and UM approve Jul 3", () => {
    const request = baseRequest();
    expect(
      fundRequestBelongsToApproverCutoff(request, jun26Cutoff, "upper_management")
    ).toBe(true);
    expect(
      fundRequestBelongsToApproverCutoff(request, jul3Cutoff, "upper_management")
    ).toBe(false);
  });

  it("matches history cutoff grouping to filing cutoff", () => {
    const request = baseRequest();
    expect(fundRequestBelongsToHistoryCutoff(request, jun26Cutoff)).toBe(true);
    expect(fundRequestBelongsToHistoryCutoff(request, jul3Cutoff)).toBe(false);
  });
});

describe("shouldShowFundRequestCutoffDeadlineTimeForPeriod", () => {
  it("hides 10 AM label for the exempt Jun 26 – Jul 2 recovery week", () => {
    expect(
      shouldShowFundRequestCutoffDeadlineTimeForPeriod(
        "2026-06-26",
        new Date(2026, 6, 3)
      )
    ).toBe(false);
  });

  it("shows 10 AM label for normal cutoffs such as Jul 3 – Jul 9", () => {
    expect(
      shouldShowFundRequestCutoffDeadlineTimeForPeriod(
        "2026-07-03",
        new Date(2026, 6, 3)
      )
    ).toBe(true);
  });
});

describe("getFundRequestHistoryCutoffs forward weeks", () => {
  it("prepends one future cutoff and selects the active week by default", () => {
    const history = getFundRequestHistoryCutoffs("2026-07-09", { forwardWeeks: 1 });
    expect(history).not.toBeNull();
    expect(history?.cutoffs[0]?.start_ymd).toBe("2026-07-10");
    expect(history?.cutoffs[1]?.start_ymd).toBe("2026-07-03");
    expect(getActiveFundRequestCutoffIndex(history?.cutoffs ?? [])).toBe(1);
  });
});
