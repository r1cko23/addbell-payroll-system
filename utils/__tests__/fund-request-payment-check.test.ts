import { describe, expect, it } from "vitest";
import {
  countFundRequestSeparateCheques,
  getFundRequestCombinedChequeAmount,
  getFundRequestPaymentCheckPeerIds,
  getFundRequestSeparateChequePrompt,
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

describe("separate cheque amounts", () => {
  it("keeps the payee total while excluding separate cheques from the combined print amount", () => {
    const requests = [
      { total_requested_amount: 494446.35, separate_cheque: false },
      { total_requested_amount: 8839.29, separate_cheque: false },
      { total_requested_amount: 20625, separate_cheque: true },
      { total_requested_amount: 3437.5, separate_cheque: false },
    ];
    const payeeTotal = requests.reduce(
      (sum, row) => sum + row.total_requested_amount,
      0
    );

    expect(payeeTotal).toBeCloseTo(527348.14, 2);
    expect(getFundRequestCombinedChequeAmount(requests)).toBeCloseTo(506723.14, 2);
    expect(countFundRequestSeparateCheques(requests)).toBe(1);
  });

  it("explains the exclusion in the separate-cheque prompt", () => {
    const prompt = getFundRequestSeparateChequePrompt({
      requestAmount: 20625,
      payeeName: "CONSTANTINO MILO JR.",
      groupTotal: 527348.14,
      combinedAfter: 506723.14,
    });
    expect(prompt.title).toBe("Print a separate cheque?");
    expect(prompt.description).toContain("₱20,625.00");
    expect(prompt.description).toContain("₱506,723.14");
    expect(prompt.description).toContain("₱527,348.14");
    expect(prompt.description).toContain("CONSTANTINO MILO JR.");
  });
});
