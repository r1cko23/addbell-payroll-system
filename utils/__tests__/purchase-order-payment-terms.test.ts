import { describe, expect, it } from "vitest";
import {
  MANUAL_PAYMENT_TERMS_VALUE,
  PURCHASE_ORDER_PAYMENT_TERM_OPTIONS,
  paymentTermsFromSelectValue,
  paymentTermsToSelectValue,
} from "@/lib/purchase-order-payment-terms";
import { normalizePOData } from "@/utils/po-format";
import { DEFAULT_COMPANY, type PurchaseOrder } from "@/types/purchase-order";

describe("purchase order payment term options", () => {
  it("lists the preset terms and treats a matching line as a dropdown pick", () => {
    expect(PURCHASE_ORDER_PAYMENT_TERM_OPTIONS).toEqual([
      "30% DP | 60% PB | 90% PB | 10% Ret (2 weeks)",
      "50% DP | 40% PB | 10% Ret (2 weeks)",
      "50% DP | 50% Upon Completion",
      "Upon Completion",
      "30 DAYS",
      "60 DAYS",
    ]);
    expect(paymentTermsToSelectValue([])).toBe("");
    expect(
      paymentTermsToSelectValue(["30 DAYS"])
    ).toBe("30 DAYS");
    expect(
      paymentTermsFromSelectValue("50% DP | 50% Upon Completion", [])
    ).toEqual(["50% DP | 50% Upon Completion"]);
    expect(paymentTermsToSelectValue(["Upon Completion"])).toBe("Upon Completion");
    expect(paymentTermsFromSelectValue("Upon Completion", [])).toEqual([
      "Upon Completion",
    ]);
  });

  it("uses manual entry when terms are blank custom text, many lines, or not in the list", () => {
    expect(paymentTermsToSelectValue(["Net 45"])).toBe(MANUAL_PAYMENT_TERMS_VALUE);
    expect(
      paymentTermsToSelectValue(["30% Down Payment", "70% Progress Billing"])
    ).toBe(MANUAL_PAYMENT_TERMS_VALUE);
    expect(
      paymentTermsFromSelectValue(MANUAL_PAYMENT_TERMS_VALUE, ["Net 45"])
    ).toEqual(["Net 45"]);
    expect(paymentTermsFromSelectValue("", [])).toEqual([]);
  });

  it("keeps DP, PB, and DAYS as typed when printing a preset term", () => {
    const po: PurchaseOrder = {
      poNumber: "ADDPO-2609-0101",
      date: "Sep. 13, 2026",
      vendor: {
        name: "Acme",
        contactPerson: "",
        tin: "",
        address: "",
        phone: "",
        email: "",
      },
      requisitioner: "",
      company: DEFAULT_COMPANY,
      projectTitle: "Site",
      deliverTo: "",
      items: [],
      paymentTerms: ["30% DP | 60% PB | 90% PB | 10% Ret (2 weeks)"],
      requestedBy: "",
      preparedBy: "",
      reviewedBy: "",
      approvedBy: "",
      approvedByTitle: "",
    };
    expect(normalizePOData(po).paymentTerms).toEqual([
      "30% DP | 60% PB | 90% PB | 10% Ret (2 weeks)",
    ]);
  });
});
