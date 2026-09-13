import { describe, expect, it } from "vitest";
import {
  purchaseOrderPrintFileName,
  purchaseOrderPrintHtmlTitle,
} from "@/lib/purchase-order-print-filename";

describe("purchase order print / Save as PDF file name", () => {
  it("uses the PO number and vendor name", () => {
    expect(
      purchaseOrderPrintFileName({
        poNumber: "ADDPO-2609-TCP01",
        vendorName: "MEGAWIDE CONSTRUCTION CORP.",
      })
    ).toBe("ADDPO-2609-TCP01 - MEGAWIDE CONSTRUCTION CORP");
  });

  it("falls back to the PO number when vendor is blank, and DRAFT when the number is missing", () => {
    expect(
      purchaseOrderPrintFileName({
        poNumber: "ADDPO-2609-TCP01",
        vendorName: "   ",
      })
    ).toBe("ADDPO-2609-TCP01");
    expect(
      purchaseOrderPrintFileName({
        poNumber: "",
        vendorName: "MEGAWIDE CONSTRUCTION CORP.",
      })
    ).toBe("DRAFT - MEGAWIDE CONSTRUCTION CORP");
    expect(purchaseOrderPrintFileName({ poNumber: "", vendorName: "" })).toBe(
      "DRAFT"
    );
  });

  it("collapses whitespace and strips characters that would split or break a saved file", () => {
    expect(
      purchaseOrderPrintFileName({
        poNumber: "  ADDPO-2609-TCP01  ",
        vendorName: "Smith / Jones\nCo: \"A\"",
      })
    ).toBe("ADDPO-2609-TCP01 - Smith Jones Co A");
  });

  it("escapes the print document title so an ampersand in the vendor name stays one file", () => {
    expect(
      purchaseOrderPrintHtmlTitle({
        poNumber: "ADDPO-2609-TCP01",
        vendorName: "Smith & Sons",
      })
    ).toBe("ADDPO-2609-TCP01 - Smith &amp; Sons");
  });
});
