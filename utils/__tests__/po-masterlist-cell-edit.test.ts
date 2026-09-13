import { describe, expect, it } from "vitest";
import { buildPoMasterlistCellPatch } from "@/lib/po-masterlist-cell-edit";

describe("in-cell masterlist edit", () => {
  it("does not patch when the cell text is unchanged", () => {
    expect(
      buildPoMasterlistCellPatch("project_title", "CIVIL WORKS", "CIVIL WORKS")
    ).toBeNull();
  });

  it("clears a cell to null when the editor is emptied", () => {
    expect(buildPoMasterlistCellPatch("location", "  ", "CALAMBA")).toEqual({
      field: "location",
      value: null,
    });
  });

  it("parses a peso amount typed in the cell", () => {
    expect(
      buildPoMasterlistCellPatch("po_amount", "₱8,500,000.00", 19800)
    ).toEqual({ field: "po_amount", value: 8500000 });
  });

  it("keeps invoice progress lines as multiline text", () => {
    const next = "440 (30%) - PAID\n580 (60%) - PAID\n581 (10%) - PAID";
    expect(buildPoMasterlistCellPatch("invoice_numbers", next, "440 (30%) - PAID")).toEqual({
      field: "invoice_numbers",
      value: next,
    });
  });

  it("does not treat invalid amount text as a clear", () => {
    expect(buildPoMasterlistCellPatch("po_amount", "not-a-number", 19800)).toBeNull();
  });

  it("clears invoice numbers when the cell is emptied", () => {
    expect(buildPoMasterlistCellPatch("invoice_numbers", "  \n  ", "440 (30%) - PAID")).toEqual({
      field: "invoice_numbers",
      value: null,
    });
  });

  it("leaves a formatted amount unchanged when it parses to the same number", () => {
    expect(
      buildPoMasterlistCellPatch("po_amount", "₱8,500,000.00", 8500000)
    ).toBeNull();
  });
});
