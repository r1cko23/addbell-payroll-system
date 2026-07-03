import {
  getFundRequestRoleCutoffBucket,
  getFundRequestRoleCutoffFilterOptions,
  getFundRequestRoleCutoffMetricLabels,
  summarizeFundRequestsForRoleCutoff,
} from "@/lib/fund-request-inbox-cutoff-summary";
import type { FundRequestRow } from "@/types/fund-request";

function baseRequest(overrides: Partial<FundRequestRow> = {}): FundRequestRow {
  return {
    id: "req-1",
    company_id: "company",
    project_id: null,
    requested_by: "employee-1",
    request_date: "2026-06-27",
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
    total_requested_amount: 10000,
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
    rejection_history: null,
    rejection_undo_snapshot: null,
    created_at: "2026-06-27T02:00:00+08:00",
    updated_at: "2026-06-27T02:00:00+08:00",
    ...overrides,
  };
}

const cutoff = { start_ymd: "2026-06-26", end_ymd: "2026-07-02", label: "Jun 26 – Jul 2" };

describe("getFundRequestRoleCutoffBucket", () => {
  it("classifies operations manager pending and approved requests", () => {
    const ctx = {
      managedRequesterIds: new Set(["employee-1"]),
      requesterRoutingById: {
        "employee-1": {
          overtimeGroupId: "group-1",
          overtimeGroupName: "Group 1",
          groupApproverUserId: "om-1",
          groupApproverRole: "operations_manager",
          groupApproverName: "OM",
          requiresOperationsManagerApproval: true,
        },
      },
    };

    expect(
      getFundRequestRoleCutoffBucket(baseRequest({ status: "pending" }), "operations_manager", ctx)
    ).toBe("pending");
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "project_manager_approved",
          project_manager_approved_by: "om-1",
          project_manager_approved_at: "2026-06-27T03:00:00+08:00",
        }),
        "operations_manager",
        ctx
      )
    ).toBe("approved");
  });

  it("classifies purchasing officer pending, approved, and rejected requests", () => {
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({ status: "project_manager_approved" }),
        "purchasing_officer"
      )
    ).toBe("pending");
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "purchasing_officer_approved",
          purchasing_officer_approved_by: "po-1",
          purchasing_officer_approved_at: "2026-06-27T04:00:00+08:00",
        }),
        "purchasing_officer"
      )
    ).toBe("approved");
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "rejected",
          project_manager_approved_at: "2026-06-27T03:00:00+08:00",
          rejected_at: "2026-06-27T05:00:00+08:00",
        }),
        "purchasing_officer"
      )
    ).toBe("rejected");
  });

  it("classifies purchasing officer rejected requests without OM approval timestamp", () => {
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "rejected",
          project_manager_approved_at: null,
          rejected_at: "2026-06-27T05:00:00+08:00",
          rejection_undo_snapshot: {
            status: "project_manager_approved",
            purchasing_officer_approved_by: null,
            purchasing_officer_approved_at: null,
            supplier_bank_details: null,
            management_approved_by: null,
            management_approved_at: null,
          },
        }),
        "purchasing_officer"
      )
    ).toBe("rejected");
  });

  it("excludes purchasing officer own requests from purchasing pending queue", () => {
    const ctx = {
      approverUserId: "po-user",
      requesterUserIdByEmployeeId: {
        "employee-1": "po-user",
      },
    };
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "project_manager_approved",
          requested_by: "employee-1",
        }),
        "purchasing_officer",
        ctx
      )
    ).toBeNull();
  });

  it("counts purchasing officer approved requests that skipped OM and moved to UM queue", () => {
    const ctx = {
      requesterRoutingById: {
        "employee-1": {
          overtimeGroupId: "group-1",
          overtimeGroupName: "Group 1",
          groupApproverUserId: "om-1",
          groupApproverRole: "operations_manager",
          groupApproverName: "OM",
          requiresOperationsManagerApproval: true,
        },
      },
    };

    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "purchasing_officer_approved",
          project_manager_approved_by: null,
          purchasing_officer_approved_by: "po-1",
          purchasing_officer_approved_at: "2026-07-02T04:00:00+08:00",
        }),
        "purchasing_officer",
        ctx
      )
    ).toBe("approved");
  });

  it("keeps UM-approved requests in purchasing approved totals when PO already acted", () => {
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "management_approved",
          purchasing_officer_approved_by: "po-1",
          purchasing_officer_approved_at: "2026-07-02T04:00:00+08:00",
          management_approved_by: "um-1",
          management_approved_at: "2026-07-03T04:00:00+08:00",
        }),
        "purchasing_officer"
      )
    ).toBe("approved");
  });
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "purchasing_officer_approved",
          purchasing_officer_approved_by: "po-1",
          purchasing_officer_approved_at: "2026-06-27T04:00:00+08:00",
        }),
        "upper_management"
      )
    ).toBe("pending");
    expect(
      getFundRequestRoleCutoffBucket(
        baseRequest({
          status: "management_approved",
          purchasing_officer_approved_by: "po-1",
          purchasing_officer_approved_at: "2026-06-27T04:00:00+08:00",
          management_approved_by: "um-1",
          management_approved_at: "2026-06-27T06:00:00+08:00",
        }),
        "upper_management"
      )
    ).toBe("approved");
  });
});

describe("summarizeFundRequestsForRoleCutoff", () => {
  it("summarizes purchasing officer requests for a cutoff", () => {
    const summary = summarizeFundRequestsForRoleCutoff(
      [
        baseRequest({ id: "a", status: "project_manager_approved", total_requested_amount: 1000 }),
        baseRequest({
          id: "b",
          status: "purchasing_officer_approved",
          purchasing_officer_approved_at: "2026-06-27T04:00:00+08:00",
          total_requested_amount: 2000,
        }),
        baseRequest({
          id: "c",
          status: "rejected",
          project_manager_approved_at: "2026-06-27T03:00:00+08:00",
          rejected_at: "2026-06-27T05:00:00+08:00",
          total_requested_amount: 3000,
        }),
      ],
      cutoff,
      "purchasing_officer"
    );

    expect(summary.total).toBe(3);
    expect(summary.pending).toBe(1);
    expect(summary.approved).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.amounts.total).toBe(6000);
  });

  it("includes PO-approved requests in total even when they are now in the UM queue", () => {
    const ctx = {
      requesterRoutingById: {
        "employee-1": {
          overtimeGroupId: "group-1",
          overtimeGroupName: "Group 1",
          groupApproverUserId: "om-1",
          groupApproverRole: "operations_manager",
          groupApproverName: "OM",
          requiresOperationsManagerApproval: true,
        },
      },
    };

    const summary = summarizeFundRequestsForRoleCutoff(
      [
        baseRequest({
          id: "pending",
          status: "project_manager_approved",
          total_requested_amount: 1000,
        }),
        baseRequest({
          id: "approved",
          status: "purchasing_officer_approved",
          project_manager_approved_by: null,
          purchasing_officer_approved_by: "po-1",
          purchasing_officer_approved_at: "2026-06-27T04:00:00+08:00",
          total_requested_amount: 2000,
        }),
        baseRequest({
          id: "rejected",
          status: "rejected",
          project_manager_approved_at: "2026-06-27T03:00:00+08:00",
          rejected_at: "2026-06-27T05:00:00+08:00",
          total_requested_amount: 3000,
        }),
      ],
      cutoff,
      "purchasing_officer",
      ctx
    );

    expect(summary.total).toBe(3);
    expect(summary.pending).toBe(1);
    expect(summary.approved).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.amounts.approved).toBe(2000);
  });
});

describe("getFundRequestRoleCutoffMetricLabels", () => {
  it("appends the stage suffix for each approver role", () => {
    expect(getFundRequestRoleCutoffMetricLabels("operations_manager")).toEqual({
      total: "Total",
      approved: "Approved (Operations)",
      rejected: "Rejected (Operations)",
      pending: "Pending (Operations)",
    });
    expect(getFundRequestRoleCutoffMetricLabels("purchasing_officer")).toEqual({
      total: "Total",
      approved: "Approved (Purchasing)",
      rejected: "Rejected (Purchasing)",
      pending: "Pending (Purchasing)",
    });
    expect(getFundRequestRoleCutoffMetricLabels("upper_management")).toEqual({
      total: "Total",
      approved: "Approved (Upper Management)",
      rejected: "Rejected (Upper Management)",
      pending: "Pending (Upper Management)",
    });
  });
});

describe("getFundRequestRoleCutoffFilterOptions", () => {
  it("returns role-specific outcome filter labels", () => {
    expect(getFundRequestRoleCutoffFilterOptions("purchasing_officer")).toEqual([
      { value: "all", label: "All" },
      { value: "approved", label: "Approved (Purchasing)" },
      { value: "rejected", label: "Rejected (Purchasing)" },
      { value: "pending", label: "Pending (Purchasing)" },
    ]);
  });
});
