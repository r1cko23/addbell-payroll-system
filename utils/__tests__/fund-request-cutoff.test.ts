import {
  FUND_REQUEST_CUTOFF_EXPIRY_REASON,
  FUND_REQUEST_CUTOFF_EXPIRY_REASON_OM,
  FUND_REQUEST_CUTOFF_EXPIRY_REASON_PO,
  FUND_REQUEST_FORWARD_CUTOFF_WEEKS,
  fundRequestBelongsToApproverCutoff,
  fundRequestBelongsToHistoryCutoff,
  getActiveFundRequestCutoffIndex,
  getFundRequestCutoffStartYmd,
  getFundRequestCutoffStartYmdForFiling,
  getFundRequestFilingCutoffStartYmd,
  getFundRequestHistoryCutoffs,
  isFundRequestCutoffExpiryRejection,
  isFundRequestPastCutoffForOmPoExpiry,
  isFundRequestPastOperationsManagerCutoff,
  isFundRequestPastPurchasingOfficerCutoff,
  shouldShowFundRequestCutoffDeadlineTimeForPeriod,
} from "@/lib/fund-request-cutoff";
import { buildFundRequestCutoffExpiryUpdates } from "@/lib/fund-request-cutoff-expiry";
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
    return_correction: null,
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
  it("uses filing/created date for history even when approved in a later week", () => {
    expect(getFundRequestCutoffStartYmd(baseRequest())).toBe("2026-06-26");
    expect(getFundRequestFilingCutoffStartYmd(baseRequest())).toBe("2026-06-26");
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
  it("keeps final approvals on the filing cutoff for audit/history", () => {
    const request = baseRequest();
    expect(fundRequestBelongsToHistoryCutoff(request, jun26Cutoff)).toBe(true);
    expect(fundRequestBelongsToHistoryCutoff(request, jul3Cutoff)).toBe(false);
  });

  it("keeps an in-pipeline OM/PO request on its filing cutoff", () => {
    const request = baseRequest({
      status: "project_manager_approved",
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      management_approved_by: null,
      management_approved_at: null,
    });
    expect(
      fundRequestBelongsToApproverCutoff(request, jun26Cutoff, "upper_management")
    ).toBe(true);
    expect(
      fundRequestBelongsToApproverCutoff(request, jul3Cutoff, "upper_management")
    ).toBe(false);
  });

  it("keeps UM-stage requests on the filing cutoff only (no active-week carryover)", () => {
    const request = baseRequest({
      status: "purchasing_officer_approved",
      management_approved_by: null,
      management_approved_at: null,
      created_at: "2026-07-01T06:00:00+08:00",
      request_date: "2026-07-01",
    });
    const now = new Date(2026, 6, 8); // Jul 8 → active Jul 3 cutoff
    expect(
      fundRequestBelongsToApproverCutoff(request, jul3Cutoff, "upper_management", now)
    ).toBe(false);
    expect(
      fundRequestBelongsToApproverCutoff(request, jun26Cutoff, "upper_management", now)
    ).toBe(true);
    expect(
      fundRequestBelongsToApproverCutoff(request, jul3Cutoff, "admin", now)
    ).toBe(false);
    expect(
      fundRequestBelongsToApproverCutoff(request, jun26Cutoff, "admin", now)
    ).toBe(true);
  });
});

describe("cutoff expiry for OM/PO", () => {
  const pendingJul6 = () =>
    baseRequest({
      status: "pending",
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      management_approved_by: null,
      management_approved_at: null,
      request_date: "2026-07-06",
      created_at: "2026-07-06T06:00:00+08:00",
    });

  const poJul6 = () =>
    baseRequest({
      status: "project_manager_approved",
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      management_approved_by: null,
      management_approved_at: null,
      request_date: "2026-07-06",
      created_at: "2026-07-06T06:00:00+08:00",
    });

  it("expires OM at Thursday 10:00 AM Manila of the filing week", () => {
    const pending = pendingJul6();
    const before = new Date("2026-07-09T09:59:00+08:00");
    const atDeadline = new Date("2026-07-09T10:00:00+08:00");
    expect(isFundRequestPastOperationsManagerCutoff(pending, before)).toBe(false);
    expect(isFundRequestPastOperationsManagerCutoff(pending, atDeadline)).toBe(true);
    expect(buildFundRequestCutoffExpiryUpdates(pending, atDeadline)).toMatchObject({
      status: "rejected",
      rejected_by: null,
      rejection_reason: FUND_REQUEST_CUTOFF_EXPIRY_REASON_OM,
    });
  });

  it("gives Purchasing until the end of the Friday after that Thursday", () => {
    const po = poJul6();
    const thursdayDeadline = new Date("2026-07-09T10:00:00+08:00");
    const fridayEvening = new Date("2026-07-10T23:59:59+08:00");
    const saturdayStart = new Date("2026-07-11T00:00:00+08:00");
    expect(isFundRequestPastPurchasingOfficerCutoff(po, thursdayDeadline)).toBe(
      false
    );
    expect(isFundRequestPastPurchasingOfficerCutoff(po, fridayEvening)).toBe(false);
    expect(isFundRequestPastPurchasingOfficerCutoff(po, saturdayStart)).toBe(true);
    expect(buildFundRequestCutoffExpiryUpdates(po, saturdayStart)).toMatchObject({
      status: "rejected",
      rejected_by: null,
      rejection_reason: FUND_REQUEST_CUTOFF_EXPIRY_REASON_PO,
    });
  });

  it("expires OM/PO requests after their own deadlines have passed", () => {
    const pending = baseRequest({
      status: "pending",
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      management_approved_by: null,
      management_approved_at: null,
    });
    const now = new Date("2026-07-08T00:00:00+08:00");
    expect(isFundRequestPastCutoffForOmPoExpiry(pending, now)).toBe(true);
    expect(buildFundRequestCutoffExpiryUpdates(pending, now)).toMatchObject({
      status: "rejected",
      rejected_by: null,
      rejection_reason: FUND_REQUEST_CUTOFF_EXPIRY_REASON_OM,
    });
  });

  it("does not expire UM-stage requests after the filing week ends", () => {
    const umPending = baseRequest({
      status: "purchasing_officer_approved",
      management_approved_by: null,
      management_approved_at: null,
    });
    const now = new Date("2026-07-08T00:00:00+08:00");
    expect(isFundRequestPastCutoffForOmPoExpiry(umPending, now)).toBe(false);
    expect(buildFundRequestCutoffExpiryUpdates(umPending, now)).toBeNull();
  });

  it("does not expire OM/PO requests still inside their filing week", () => {
    const now = new Date("2026-07-08T00:00:00+08:00");
    expect(isFundRequestPastCutoffForOmPoExpiry(pendingJul6(), now)).toBe(false);
    expect(isFundRequestPastCutoffForOmPoExpiry(poJul6(), now)).toBe(false);
  });

  it("does not expire requests moved into a cutoff after the deadline", () => {
    const moved = poJul6();
    moved.cutoff_adjustment_history = [
      {
        moved_by: "um-1",
        moved_at: "2026-07-11T02:00:00+08:00",
        from_cutoff_start_ymd: "2026-07-10",
        to_cutoff_start_ymd: "2026-07-03",
        from_created_at: "2026-07-10T06:00:00+08:00",
        to_created_at: moved.created_at,
        from_request_date: "2026-07-10",
        to_request_date: moved.request_date,
        undone_at: null,
        undone_by: null,
      },
    ];
    const now = new Date("2026-07-11T00:00:00+08:00");
    expect(isFundRequestPastCutoffForOmPoExpiry(moved, now)).toBe(false);
    expect(buildFundRequestCutoffExpiryUpdates(moved, now)).toBeNull();
  });

  it("does not expire requests returned to purchasing after UM review", () => {
    const returned = baseRequest({
      status: "project_manager_approved",
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      management_approved_by: null,
      management_approved_at: null,
      returned_at: "2026-07-08T02:00:00+08:00",
      returned_by: "um-1",
      return_reason: "Correct: Total Requested Amount",
      rejection_undo_snapshot: {
        status: "purchasing_officer_approved",
        purchasing_officer_approved_by: "po-1",
        purchasing_officer_approved_at: "2026-07-03T02:00:00+08:00",
        supplier_bank_details: null,
        management_approved_by: null,
        management_approved_at: null,
      },
    });
    const now = new Date("2026-07-11T00:00:00+08:00");
    expect(isFundRequestPastCutoffForOmPoExpiry(returned, now)).toBe(false);
    expect(buildFundRequestCutoffExpiryUpdates(returned, now)).toBeNull();
  });

  it("treats OM, PO, and historical cutoff reasons as auto-cancels", () => {
    expect(
      isFundRequestCutoffExpiryRejection({
        rejected_by: null,
        rejection_reason: FUND_REQUEST_CUTOFF_EXPIRY_REASON_OM,
      })
    ).toBe(true);
    expect(
      isFundRequestCutoffExpiryRejection({
        rejected_by: null,
        rejection_reason: FUND_REQUEST_CUTOFF_EXPIRY_REASON_PO,
      })
    ).toBe(true);
    expect(
      isFundRequestCutoffExpiryRejection({
        rejected_by: null,
        rejection_reason: FUND_REQUEST_CUTOFF_EXPIRY_REASON,
      })
    ).toBe(true);
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
    const history = getFundRequestHistoryCutoffs("2026-07-09", {
      forwardWeeks: FUND_REQUEST_FORWARD_CUTOFF_WEEKS,
    });
    expect(history).not.toBeNull();
    expect(history?.cutoffs[0]?.start_ymd).toBe("2026-07-10");
    expect(history?.cutoffs[1]?.start_ymd).toBe("2026-07-03");
    expect(getActiveFundRequestCutoffIndex(history?.cutoffs ?? [], new Date(2026, 6, 9))).toBe(1);
  });
});
