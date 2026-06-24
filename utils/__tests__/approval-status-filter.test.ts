import {
  filterFtlRequestsByStatus,
  filterLeaveRequestsByStatus,
  filterOtRequestsByStatus,
  matchesFtlApprovalStatusFilter,
  matchesLeaveApprovalStatusFilter,
  matchesOtApprovalStatusFilter,
  shouldApplyViewerStatusFilter,
} from "@/lib/approval-status-filter";

describe("shouldApplyViewerStatusFilter", () => {
  test("only ops manager and upper management use viewer status filter", () => {
    expect(shouldApplyViewerStatusFilter(true)).toBe(true);
    expect(shouldApplyViewerStatusFilter(false)).toBe(false);
  });
});

describe("matchesOtApprovalStatusFilter", () => {
  test("pending uses viewer status (endorsed to HR is not pending for first approver)", () => {
    expect(
      matchesOtApprovalStatusFilter("pending", "approved_by_manager", "pending")
    ).toBe(false);
    expect(matchesOtApprovalStatusFilter("pending", "pending", "pending")).toBe(
      true
    );
  });

  test("approved and rejected use DB status", () => {
    expect(matchesOtApprovalStatusFilter("approved", "approved", "approved")).toBe(
      true
    );
    expect(
      matchesOtApprovalStatusFilter("pending", "approved_by_manager", "approved")
    ).toBe(false);
  });
});

describe("matchesFtlApprovalStatusFilter", () => {
  test("approved filter requires DB approved, not viewer endorsed label", () => {
    expect(
      matchesFtlApprovalStatusFilter("pending", "approved", "approved")
    ).toBe(false);
    expect(
      matchesFtlApprovalStatusFilter("approved", "approved", "approved")
    ).toBe(true);
  });
});

describe("matchesLeaveApprovalStatusFilter", () => {
  test("approved_by_pm includes manager-approved DB statuses", () => {
    expect(
      matchesLeaveApprovalStatusFilter(
        "approved_by_manager",
        "approved_by_pm",
        "approved_by_pm"
      )
    ).toBe(true);
  });
});

describe("filterOtRequestsByStatus", () => {
  const rows = [
    { id: "1", status: "pending" },
    { id: "2", status: "approved" },
  ];

  test("HR/admin path leaves rows unchanged (server + queue rules apply)", () => {
    const getViewerStatus = () => "pending";
    expect(
      filterOtRequestsByStatus(rows, "approved", false, getViewerStatus)
    ).toEqual(rows);
  });

  test("first approver path applies viewer filter", () => {
    const getViewerStatus = (row: { id: string; status: string }) =>
      row.status === "pending" ? "pending" : row.status;
    expect(
      filterOtRequestsByStatus(rows, "approved", true, getViewerStatus)
    ).toEqual([{ id: "2", status: "approved" }]);
  });
});

describe("filterLeaveRequestsByStatus", () => {
  test("HR path does not strip manager-approved rows from pending filter", () => {
    const rows = [{ id: "1", status: "approved_by_pm" }];
    expect(
      filterLeaveRequestsByStatus(
        rows,
        "pending",
        false,
        () => "approved_by_pm"
      )
    ).toEqual(rows);
  });
});

describe("filterFtlRequestsByStatus", () => {
  test("first approver pending excludes endorsed viewer rows", () => {
    const rows = [
      { id: "1", status: "pending" },
      { id: "2", status: "pending" },
    ];
    const getViewerStatus = (row: { id: string }) =>
      row.id === "2" ? "approved" : "pending";
    expect(
      filterFtlRequestsByStatus(rows, "pending", true, getViewerStatus)
    ).toEqual([{ id: "1", status: "pending" }]);
  });
});
