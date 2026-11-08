import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/portal-session", () => ({ getPortalSession: async () => null }));

import {
  canActOnFundRequest,
  canReturnFundRequestToPurchasing,
  canUndoFundRequestManagementApproval,
  getActionableFundRequestStatuses,
} from "@/lib/fund-request-approval";
import {
  canDeleteFundRequestPaymentCheck,
  canUploadFundRequestPaymentCheck,
  canViewFundRequestPaymentChecksInInbox,
} from "@/lib/fund-request-payment-check";
import { canMoveFundRequestToCurrentCutoff } from "@/lib/fund-request-cutoff-move";
import {
  assertApproverCanDeletePaymentCheck,
  assertApproverCanUploadPaymentCheck,
} from "@/lib/fund-request-api";
import { mergePermissions } from "@/lib/permissions";
import { getDefaultLandingRoute } from "@/lib/default-landing-route";
import { fundRequestQueueViewRole } from "@/lib/user-roles";
import type { FundRequestRow } from "@/types/fund-request";

const AA = "admin_assistant";

function adminWithRequest(status: string) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: "r1", requested_by: "e1", status }, error: null }) }),
      }),
    }),
  } as never;
}

describe("admin assistant role", () => {
  it("lists the Upper Management queue but can act on nothing", () => {
    expect(fundRequestQueueViewRole(AA)).toBe("upper_management");
    expect(fundRequestQueueViewRole("purchasing_officer")).toBe("purchasing_officer");
    expect(getActionableFundRequestStatuses(AA)).toEqual([]);
    for (const status of ["pending", "project_manager_approved", "purchasing_officer_approved"]) {
      expect(canActOnFundRequest(AA, status)).toBe(false);
    }
    expect(canReturnFundRequestToPurchasing(AA, "purchasing_officer_approved")).toBe(false);
    const approved = {
      status: "management_approved",
      management_approved_at: "2026-11-08T00:00:00Z",
      purchasing_officer_approved_at: "2026-11-07T00:00:00Z",
      management_approved_by: "someone-else",
    } as FundRequestRow;
    expect(canUndoFundRequestManagementApproval(AA, "aa-user", approved)).toBe(false);
    expect(
      canMoveFundRequestToCurrentCutoff(
        { status: "purchasing_officer_approved", request_date: "2026-11-01", created_at: "2026-11-01T00:00:00Z" },
        AA
      )
    ).toBe(false);
  });

  it("uploads and sees cheques but cannot delete them", () => {
    expect(canUploadFundRequestPaymentCheck(AA, "purchasing_officer_approved")).toBe(true);
    expect(canUploadFundRequestPaymentCheck(AA, "management_approved")).toBe(true);
    expect(canUploadFundRequestPaymentCheck(AA, "pending")).toBe(false);
    expect(canViewFundRequestPaymentChecksInInbox(AA)).toBe(true);
    expect(canDeleteFundRequestPaymentCheck(AA, "management_approved")).toBe(false);
    expect(canDeleteFundRequestPaymentCheck("upper_management", "management_approved")).toBe(true);
  });

  it("server asserts: upload allowed, delete refused", async () => {
    const upload = await assertApproverCanUploadPaymentCheck(adminWithRequest("management_approved"), "aa-user", "r1", AA);
    expect("existing" in upload).toBe(true);
    const del = await assertApproverCanDeletePaymentCheck(adminWithRequest("management_approved"), "aa-user", "r1", AA);
    expect(del).toEqual({ error: "Not authorized to delete payment checks", status: 403 });
    const umDelete = await assertApproverCanDeletePaymentCheck(adminWithRequest("management_approved"), "um-user", "r1", "upper_management");
    expect("existing" in umDelete).toBe(true);
  });

  it("only reads fund requests and lands on them", () => {
    const perms = mergePermissions(AA, null);
    const granted = Object.entries(perms).flatMap(([module, actions]) =>
      Object.entries(actions).filter(([, ok]) => ok).map(([action]) => `${module}.${action}`)
    );
    expect(granted).toEqual(["fund_requests.read"]);
    expect(getDefaultLandingRoute(AA, null)).toBe("/fund-request");
  });
});
