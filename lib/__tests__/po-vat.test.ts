import { describe, expect, it } from "vitest";
import { poVatTotals } from "@/lib/po-vat";

describe("poVatTotals", () => {
  it("VAT Inc: the typed amount is the total; sub-total is amount / 1.12", () => {
    expect(poVatTotals(1120, "vat_inclusive")).toEqual({ subtotal: 1000, vatAmount: 120, totalAmount: 1120 });
    const r = poVatTotals(1000, "vat_inclusive");
    expect(r).toEqual({ subtotal: 892.86, vatAmount: 107.14, totalAmount: 1000 });
  });

  it("VAT Ex: the typed amount is the sub-total; total is amount × 1.12", () => {
    expect(poVatTotals(1000, "vat_exclusive")).toEqual({ subtotal: 1000, vatAmount: 120, totalAmount: 1120 });
    expect(poVatTotals(333.33, "vat_exclusive")).toEqual({ subtotal: 333.33, vatAmount: 40, totalAmount: 373.33 });
  });

  it("Non-VAT: no VAT, the typed amount is the total", () => {
    expect(poVatTotals(1000, "non_vat")).toEqual({ subtotal: 1000, vatAmount: 0, totalAmount: 1000 });
  });

  it("sub-total plus VAT always equals the total", () => {
    for (const amount of [0.01, 99.99, 12345.67, 1_000_000.5]) {
      for (const mode of ["vat_inclusive", "vat_exclusive", "non_vat"] as const) {
        const r = poVatTotals(amount, mode);
        expect(Math.round((r.subtotal + r.vatAmount) * 100)).toBe(Math.round(r.totalAmount * 100));
      }
    }
  });
});
