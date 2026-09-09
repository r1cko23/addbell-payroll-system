import { describe, expect, it } from "vitest";
import {
  buildFundRequestCreatedAtForCalendarCutoff,
  buildFundRequestMoveToCurrentCutoffUpdates,
  buildFundRequestUndoCutoffMoveUpdates,
  canMoveFundRequestToCurrentCutoff,
  canUndoFundRequestCutoffMove,
} from "@/lib/fund-request-cutoff-move";
import {
  getFundRequestCalendarCutoffStartYmd,
  getFundRequestCurrentProcessingCutoffStartYmd,
  getFundRequestFilingCutoffStartYmd,
  isFundRequestInCurrentProcessingSucceedingCutoff,
  isFundRequestInSucceedingCutoff,
} from "@/lib/fund-request-cutoff";
import type { FundRequestRow } from "@/types/fund-request";

function baseRequest(overrides: Partial<FundRequestRow> = {}): FundRequestRow {
  return {
    id: "req-1",
    company_id: "company",
    project_id: null,
    requested_by: "employee-1",
    request_date: "2026-07-09",
    purpose: "Project Funds",
    reference_mode: "client_linked",
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
    status: "purchasing_officer_approved",
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
    rejection_undo_snapshot: null,
    rejection_history: [],
    cutoff_adjustment_history: [],
    created_at: "2026-07-09T08:11:10.745628+00:00",
    updated_at: "2026-07-09T08:11:10.745628+00:00",
    ...overrides,
  };
}

/** Friday after the Jul 9 Thursday deadline — UM is still on Jul 3–9. */
const fridayAfterJulDeadline = new Date("2026-07-10T04:00:00.000Z");
/** Friday Aug 14 night — UM is still on Aug 7–13. */
const fridayAug14 = new Date("2026-08-14T14:00:00.000Z");

describe("fund request cutoff move", () => {
  it("detects requests rolled into the succeeding cutoff", () => {
    const request = baseRequest();
    expect(isFundRequestInSucceedingCutoff(request)).toBe(true);
    expect(getFundRequestCalendarCutoffStartYmd(request)).toBe("2026-07-03");
    expect(getFundRequestFilingCutoffStartYmd(request)).toBe("2026-07-10");
  });

  it("treats the previous cutoff as the current UM batch after Thursday 10:00 AM", () => {
    expect(getFundRequestCurrentProcessingCutoffStartYmd(fridayAfterJulDeadline)).toBe(
      "2026-07-03"
    );
    expect(getFundRequestCurrentProcessingCutoffStartYmd(fridayAug14)).toBe("2026-08-07");
    expect(
      isFundRequestInCurrentProcessingSucceedingCutoff(
        baseRequest(),
        fridayAfterJulDeadline
      )
    ).toBe(true);
  });

  it("allows upper management to move rolled-forward pending requests", () => {
    expect(
      canMoveFundRequestToCurrentCutoff(
        baseRequest(),
        "upper_management",
        fridayAfterJulDeadline
      )
    ).toBe(true);
    expect(
      canMoveFundRequestToCurrentCutoff(baseRequest(), "admin", fridayAfterJulDeadline)
    ).toBe(false);
    expect(
      canMoveFundRequestToCurrentCutoff(
        baseRequest({ status: "management_approved" }),
        "upper_management",
        fridayAfterJulDeadline
      )
    ).toBe(false);
  });

  it("builds a created_at before the Thursday deadline", () => {
    const request = baseRequest();
    expect(buildFundRequestCreatedAtForCalendarCutoff(request, fridayAfterJulDeadline)).toBe(
      "2026-07-09T01:00:00.000+00:00"
    );
  });

  it("moves a request back to the previous cutoff and appends audit history", () => {
    const request = baseRequest();
    const result = buildFundRequestMoveToCurrentCutoffUpdates(
      request,
      "um-user-1",
      "2026-07-10T02:17:00.000Z",
      fridayAfterJulDeadline
    );

    expect(result).not.toBeNull();
    expect(result?.updates.created_at).toBe("2026-07-09T01:00:00.000+00:00");
    expect(result?.adjustment.from_cutoff_start_ymd).toBe("2026-07-10");
    expect(result?.adjustment.to_cutoff_start_ymd).toBe("2026-07-03");
    expect(result?.adjustment.moved_by).toBe("um-user-1");
    expect(
      getFundRequestFilingCutoffStartYmd({
        ...request,
        created_at: result!.updates.created_at as string,
      })
    ).toBe("2026-07-03");
  });

  it("moves Friday filings into the previous cutoff by placing them on that week's Thursday", () => {
    const request = baseRequest({
      request_date: "2026-08-14",
      created_at: "2026-08-14T01:31:23.649693+00:00",
    });
    expect(getFundRequestFilingCutoffStartYmd(request)).toBe("2026-08-14");
    expect(
      canMoveFundRequestToCurrentCutoff(request, "upper_management", fridayAug14)
    ).toBe(true);

    const result = buildFundRequestMoveToCurrentCutoffUpdates(
      request,
      "um-user-1",
      "2026-08-14T14:07:00.000Z",
      fridayAug14
    );

    expect(result?.updates.request_date).toBe("2026-08-13");
    expect(result?.updates.created_at).toBe("2026-08-13T01:00:00.000+00:00");
    expect(result?.adjustment.from_cutoff_start_ymd).toBe("2026-08-14");
    expect(result?.adjustment.to_cutoff_start_ymd).toBe("2026-08-07");
    expect(
      getFundRequestFilingCutoffStartYmd({
        ...request,
        request_date: result!.updates.request_date as string,
        created_at: result!.updates.created_at as string,
      })
    ).toBe("2026-08-07");
  });

  it("undoes the latest cutoff move and restores the original created_at", () => {
    const movedAt = "2026-07-10T02:17:00.000Z";
    const moveResult = buildFundRequestMoveToCurrentCutoffUpdates(
      baseRequest(),
      "um-user-1",
      movedAt,
      fridayAfterJulDeadline
    );
    const movedRequest = {
      ...baseRequest(),
      created_at: moveResult!.updates.created_at as string,
      cutoff_adjustment_history: moveResult!.updates.cutoff_adjustment_history,
    } as FundRequestRow;

    expect(canUndoFundRequestCutoffMove(movedRequest, "upper_management")).toBe(true);

    const undoResult = buildFundRequestUndoCutoffMoveUpdates(
      movedRequest,
      "um-user-2",
      "2026-07-10T03:00:00.000Z"
    );

    expect(undoResult?.updates.created_at).toBe("2026-07-09T08:11:10.745628+00:00");
    expect(undoResult?.updates.cutoff_adjustment_history).toEqual([
      expect.objectContaining({
        moved_by: "um-user-1",
        undone_by: "um-user-2",
        undone_at: "2026-07-10T03:00:00.000Z",
      }),
    ]);
    expect(
      getFundRequestFilingCutoffStartYmd({
        ...movedRequest,
        created_at: undoResult!.updates.created_at as string,
      })
    ).toBe("2026-07-10");
    expect(
      canUndoFundRequestCutoffMove(
        {
          ...movedRequest,
          created_at: undoResult!.updates.created_at as string,
          cutoff_adjustment_history: undoResult!.updates.cutoff_adjustment_history,
        },
        "upper_management"
      )
    ).toBe(false);
  });

  it("undoes a Friday filing move and restores the original request_date", () => {
    const request = baseRequest({
      request_date: "2026-08-14",
      created_at: "2026-08-14T01:31:23.649693+00:00",
    });
    const moveResult = buildFundRequestMoveToCurrentCutoffUpdates(
      request,
      "um-user-1",
      "2026-08-14T14:07:00.000Z",
      fridayAug14
    );
    const movedRequest = {
      ...request,
      request_date: moveResult!.updates.request_date as string,
      created_at: moveResult!.updates.created_at as string,
      cutoff_adjustment_history: moveResult!.updates.cutoff_adjustment_history,
    } as FundRequestRow;

    const undoResult = buildFundRequestUndoCutoffMoveUpdates(
      movedRequest,
      "um-user-2",
      "2026-08-14T14:10:00.000Z"
    );

    expect(undoResult?.updates.request_date).toBe("2026-08-14");
    expect(undoResult?.updates.created_at).toBe("2026-08-14T01:31:23.649693+00:00");
  });
});
