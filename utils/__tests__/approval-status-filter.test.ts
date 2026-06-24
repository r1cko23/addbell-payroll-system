import {
  filterFtlRequestsByStatus,
  filterLeaveRequestsByStatus,
  filterOtRequestsByStatus,
  matchesFtlApprovalStatusFilter,
  matchesLeaveApprovalStatusFilter,
  matchesOtApprovalStatusFilter,
  shouldApplyServerStatusFilter,
  shouldApplyViewerStatusFilter,
} from "@/lib/approval-status-filter";

describe("shouldApplyViewerStatusFilter", () => {
  test("only ops manager and upper management use viewer status filter", () => {
    expect(shouldApplyViewerStatusFilter(true)).toBe(true);
    expect(shouldApplyViewerStatusFilter(false)).toBe(false);
  });
});

describe("shouldApplyServerStatusFilter", () => {
  const firstApprover = {
    isHR: false,
    isFirstApproverDashboardView: true,
  };

  test("first approver approved is client-only (endorsed rows stay DB pending)", () => {
    expect(
      shouldApplyServerStatusFilter("approved", {
        ...firstApprover,
        queueKind: "ot",
      })
    ).toBe(false);
    expect(
      shouldApplyServerStatusFilter("approved_by_pm", {
        ...firstApprover,
        queueKind: "leave",
      })
    ).toBe(false);
  });

  test("first approver rejected still uses DB status on server", () => {
    expect(
      shouldApplyServerStatusFilter("rejected", {
        ...firstApprover,
        queueKind: "ot",
      })
    ).toBe(true);
  });

  test("HR pending skips server status filter", () => {
    expect(
      shouldApplyServerStatusFilter("pending", {
        isHR: true,
        isFirstApproverDashboardView: false,
        queueKind: "ot",
      })
    ).toBe(false);
  });

  test("HR approved uses server status filter", () => {
    expect(
      shouldApplyServerStatusFilter("approved", {
        isHR: true,
        isFirstApproverDashboardView: false,
        queueKind: "ot",
      })
    ).toBe(true);
  });
});

describe("matchesOtApprovalStatusFilter", () => {
  test("pending uses viewer status (endorsed to HR is not pending for manager)", () => {
    expect(
      matchesOtApprovalStatusFilter("pending", "approved_by_manager", "pending")
    ).toBe(false);
    expect(matchesOtApprovalStatusFilter("pending", "pending", "pending")).toBe(
      true
    );
  });

  test("approved uses viewer status so manager sees endorsed items", () => {
    expect(matchesOtApprovalStatusFilter("approved", "approved", "approved")).toBe(
      true
    );
    expect(
      matchesOtApprovalStatusFilter("pending", "approved_by_manager", "approved")
    ).toBe(true);
    expect(matchesOtApprovalStatusFilter("pending", "pending", "approved")).toBe(
      false
    );
  });

  test("rejected uses viewer status", () => {
    expect(
      matchesOtApprovalStatusFilter("rejected", "rejected", "rejected")
    ).toBe(true);
  });
});

describe("matchesFtlApprovalStatusFilter", () => {
  test("approved uses viewer endorsed label, not DB pending", () => {
    expect(
      matchesFtlApprovalStatusFilter("pending", "approved", "approved")
    ).toBe(true);
    expect(
      matchesFtlApprovalStatusFilter("approved", "approved", "approved")
    ).toBe(true);
    expect(matchesFtlApprovalStatusFilter("pending", "pending", "approved")).toBe(
      false
    );
  });
});

describe("matchesLeaveApprovalStatusFilter", () => {
  test("approved_by_pm uses viewer status for manager-endorsed pending rows", () => {
    expect(
      matchesLeaveApprovalStatusFilter(
        "pending",
        "approved_by_pm",
        "approved_by_pm"
      )
    ).toBe(true);
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
    { id: "3", status: "pending" },
  ];

  test("HR/admin path leaves rows unchanged (server + queue rules apply)", () => {
    const getViewerStatus = () => "pending";
    expect(
      filterOtRequestsByStatus(rows, "approved", false, getViewerStatus)
    ).toEqual(rows);
  });

  test("first approver approved includes manager-endorsed viewer rows", () => {
    const getViewerStatus = (row: { id: string; status: string }) => {
      if (row.id === "3") return "approved_by_manager";
      return row.status === "pending" ? "pending" : row.status;
    };
    expect(
      filterOtRequestsByStatus(rows, "approved", true, getViewerStatus)
    ).toEqual([
      { id: "2", status: "approved" },
      { id: "3", status: "pending" },
    ]);
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

  test("first approver approved includes endorsed viewer rows", () => {
    const rows = [
      { id: "1", status: "pending" },
      { id: "2", status: "pending" },
    ];
    const getViewerStatus = (row: { id: string }) =>
      row.id === "2" ? "approved" : "pending";
    expect(
      filterFtlRequestsByStatus(rows, "approved", true, getViewerStatus)
    ).toEqual([{ id: "2", status: "pending" }]);
  });
});
