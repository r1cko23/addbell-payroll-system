import { describe, expect, it } from "vitest";
import {
  getFundRequestPaymentCheckPeerIds,
  isFundRequestPaymentCheckPeer,
} from "@/lib/fund-request-payment-check";
import type { FundRequestPaymentCheckPeerRow } from "@/lib/fund-request-payment-check";

function peerRow(
  overrides: Partial<FundRequestPaymentCheckPeerRow> & Pick<FundRequestPaymentCheckPeerRow, "id">
): FundRequestPaymentCheckPeerRow {
  return {
    supplier_bank_details: JSON.stringify({ accountName: "CARIZZA DIOSELLE LEONARDO" }),
    status: "purchasing_officer_approved",
    created_at: "2026-07-09T01:25:00+00:00",
    request_date: "2026-07-09",
    ...overrides,
  };
}

describe("fund request payment check peers", () => {
  it("groups same payee within the same cutoff week", () => {
    const current = peerRow({ id: "current" });
    const sameWeek = peerRow({
      id: "same-week",
      created_at: "2026-07-09T01:15:00+00:00",
    });

    expect(isFundRequestPaymentCheckPeer(current, sameWeek)).toBe(true);
    expect(getFundRequestPaymentCheckPeerIds(current, [current, sameWeek])).toEqual([
      "current",
      "same-week",
    ]);
  });

  it("does not group same payee from a previous cutoff week", () => {
    const current = peerRow({ id: "current" });
    const previousCutoff = peerRow({
      id: "previous",
      status: "management_approved",
      created_at: "2026-07-02T01:29:57+00:00",
      request_date: "2026-07-02",
    });

    expect(isFundRequestPaymentCheckPeer(current, previousCutoff)).toBe(false);
    expect(getFundRequestPaymentCheckPeerIds(current, [current, previousCutoff])).toEqual([
      "current",
    ]);
  });

  it("does not group different payees in the same cutoff week", () => {
    const current = peerRow({ id: "current" });
    const otherPayee = peerRow({
      id: "other-payee",
      supplier_bank_details: JSON.stringify({ accountName: "RENE ARANDIA JR." }),
    });

    expect(isFundRequestPaymentCheckPeer(current, otherPayee)).toBe(false);
    expect(getFundRequestPaymentCheckPeerIds(current, [current, otherPayee])).toEqual([
      "current",
    ]);
  });
});
