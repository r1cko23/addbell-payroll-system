import { describe, expect, it } from "vitest";
import {
  formatPoMasterlistInvoiceChip,
  formatPoMasterlistInvoiceGlance,
  parsePoMasterlistInvoiceNumbers,
  serializePoMasterlistInvoiceNumbers,
} from "@/lib/po-masterlist-invoice-lines";

describe("P.O. masterlist invoice schedule", () => {
  it("parses a 30/60/10 progress billing cell into three lines", () => {
    const cell = "440 (30%) - PAID\n580 (60%) - PAID\n581 (10%) - PAID";
    expect(parsePoMasterlistInvoiceNumbers(cell)).toEqual([
      { raw: "440 (30%) - PAID", invoiceNumber: "440", percent: 30, status: "PAID" },
      { raw: "580 (60%) - PAID", invoiceNumber: "580", percent: 60, status: "PAID" },
      { raw: "581 (10%) - PAID", invoiceNumber: "581", percent: 10, status: "PAID" },
    ]);
  });

  it("keeps a 100% line and a percent-only retention line", () => {
    const lines = parsePoMasterlistInvoiceNumbers("605 (100%)\n1680 (10%)");
    expect(lines).toEqual([
      { raw: "605 (100%)", invoiceNumber: "605", percent: 100, status: null },
      { raw: "1680 (10%)", invoiceNumber: "1680", percent: 10, status: null },
    ]);
  });

  it("keeps unparseable leftovers as raw text so nothing is dropped", () => {
    const lines = parsePoMasterlistInvoiceNumbers("see billing workbook\n440 (30%) - PAID");
    expect(lines[0]).toEqual({
      raw: "see billing workbook",
      invoiceNumber: null,
      percent: null,
      status: null,
    });
    expect(lines[1]?.invoiceNumber).toBe("440");
  });

  it("returns no lines for empty cells", () => {
    expect(parsePoMasterlistInvoiceNumbers(null)).toEqual([]);
    expect(parsePoMasterlistInvoiceNumbers("")).toEqual([]);
    expect(parsePoMasterlistInvoiceNumbers("   \n  ")).toEqual([]);
  });

  it("round-trips a well-formed progress cell back to the original text", () => {
    const cell = "440 (30%) - PAID\n580 (60%) - PAID\n581 (10%) - PAID";
    expect(
      serializePoMasterlistInvoiceNumbers(parsePoMasterlistInvoiceNumbers(cell))
    ).toBe(cell);
  });

  it("parses a single invoice line without forcing a percent or status", () => {
    expect(parsePoMasterlistInvoiceNumbers("1742")).toEqual([
      {
        raw: "1742",
        invoiceNumber: "1742",
        percent: null,
        status: null,
      },
    ]);
  });

  it("formats a glance chip as number and percent so many invoices can wrap", () => {
    expect(
      formatPoMasterlistInvoiceGlance({
        raw: "440 (30%) - PAID",
        invoiceNumber: "440",
        percent: 30,
        status: "PAID",
      })
    ).toBe("#440 · 30%");
    expect(
      formatPoMasterlistInvoiceGlance({
        raw: "1742",
        invoiceNumber: "1742",
        percent: null,
        status: null,
      })
    ).toBe("#1742");
    expect(
      formatPoMasterlistInvoiceGlance({
        raw: "see billing workbook",
        invoiceNumber: null,
        percent: null,
        status: null,
      })
    ).toBe("see billing workbook");
    const many = parsePoMasterlistInvoiceNumbers(
      "440 (30%) - PAID\n580 (60%) - PAID\n581 (10%) - PAID"
    );
    expect(many.map((line) => formatPoMasterlistInvoiceGlance(line))).toEqual([
      "#440 · 30%",
      "#580 · 60%",
      "#581 · 10%",
    ]);
  });

  it("formats stacked chips for zero, one, and many invoice lines", () => {
    expect(parsePoMasterlistInvoiceNumbers(null)).toEqual([]);
    expect(
      formatPoMasterlistInvoiceChip({
        raw: "440 (30%) - PAID",
        invoiceNumber: "440",
        percent: 30,
        status: "PAID",
      })
    ).toBe("#440 · 30% · PAID");
    const many = parsePoMasterlistInvoiceNumbers(
      "440 (30%) - PAID\n580 (60%) - PAID\n581 (10%) - PAID"
    );
    expect(many.map((line) => formatPoMasterlistInvoiceChip(line))).toEqual([
      "#440 · 30% · PAID",
      "#580 · 60% · PAID",
      "#581 · 10% · PAID",
    ]);
  });

  it("keeps five mixed progress lines including duplicate 30% invoices", () => {
    const cell =
      "328 (30%) - PAID\n482 (30%) - PAID\n527 (30%) - PAID\n651 (100%) - PAID\n1508 (10%) - PAID";
    const lines = parsePoMasterlistInvoiceNumbers(cell);
    expect(lines).toHaveLength(5);
    expect(lines.map((line) => line.percent)).toEqual([30, 30, 30, 100, 10]);
    expect(serializePoMasterlistInvoiceNumbers(lines)).toBe(cell);
  });
});
