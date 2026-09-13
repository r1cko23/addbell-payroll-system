import { describe, expect, it } from "vitest";
import {
  buildPoMasterlistSheetBatchValueRanges,
  buildPoMasterlistSheetRowValues,
  canMirrorPoMasterlistJob,
  formatPoMasterlistSheetAmount,
  formatPoMasterlistSheetDate,
  poMasterlistSheetRowsEqual,
  quotePoMasterlistSheetRowRange,
} from "@/lib/po-masterlist-sheet-row";

describe("po masterlist sheet row mapping", () => {
  it("formats ISO dates like the masterlist display", () => {
    expect(formatPoMasterlistSheetDate("2022-09-15")).toBe("15-Sep-2022");
    expect(formatPoMasterlistSheetDate("2024-12-09")).toBe("9-Dec-2024");
    expect(formatPoMasterlistSheetDate(null)).toBe("");
  });

  it("formats amounts with peso and two decimals", () => {
    expect(formatPoMasterlistSheetAmount(83000)).toBe("₱83,000.00");
    expect(formatPoMasterlistSheetAmount(1363490.7)).toBe("₱1,363,490.70");
    expect(formatPoMasterlistSheetAmount(null)).toBe("");
  });

  it("builds a full A:N row for one values.update", () => {
    const row = buildPoMasterlistSheetRowValues({
      po_date: "2022-12-15",
      po_received_date: "2022-12-24",
      po_number: "RI 7000025065",
      po_amount: 2225000,
      project_title: "CIVIL WORKS - TOILET IMPROVEMENT",
      client_name: "ROBINSON'S DEPARTMENT STORE",
      location: "RDS RP GALLERIA",
      payment_terms: "30 DAYS",
      cari: "RELEASED",
      cari_expiry: "2024-12-09",
      project_status: "COMPLETED",
      payment_status: "PAID",
      invoice_numbers: "2996 (30%) - PAID",
      general_remarks: null,
    });

    expect(row).toHaveLength(14);
    expect(row[0]).toBe("15-Dec-2022");
    expect(row[2]).toBe("RI 7000025065");
    expect(row[3]).toBe("₱2,225,000.00");
    expect(row[8]).toBe("RELEASED");
    expect(row[9]).toBe("9-Dec-2024");
    expect(row[13]).toBe("");
  });

  it("quotes sheet ranges for a known tab + row", () => {
    expect(quotePoMasterlistSheetRowRange("ADD-BELL 2024", 4)).toBe(
      "'ADD-BELL 2024'!A4:N4"
    );
    expect(quotePoMasterlistSheetRowRange("O'Brien", 12)).toBe(
      "'O''Brien'!A12:N12"
    );
  });

  it("builds one batchUpdate range per row", () => {
    expect(buildPoMasterlistSheetBatchValueRanges([])).toEqual([]);
    expect(
      buildPoMasterlistSheetBatchValueRanges([
        { sheetTab: "ADD-BELL 2024", sheetRow: 4, values: ["a"] },
        { sheetTab: "ADD-BELL 2024", sheetRow: 5, values: ["b"] },
      ])
    ).toEqual([
      {
        range: "'ADD-BELL 2024'!A4:N4",
        majorDimension: "ROWS",
        values: [["a"]],
      },
      {
        range: "'ADD-BELL 2024'!A5:N5",
        majorDimension: "ROWS",
        values: [["b"]],
      },
    ]);
  });

  it("requires sheet_tab and sheet_row before mirroring", () => {
    expect(
      canMirrorPoMasterlistJob({ sheet_tab: "Tab", sheet_row: 4 })
    ).toBe(true);
    expect(
      canMirrorPoMasterlistJob({ sheet_tab: null, sheet_row: 4 })
    ).toBe(false);
    expect(
      canMirrorPoMasterlistJob({ sheet_tab: "Tab", sheet_row: null })
    ).toBe(false);
  });

  it("treats an app row and sheet row as equal after formatting", () => {
    const source = {
      po_date: "2022-12-15",
      po_received_date: "2022-12-24",
      po_number: "RI 7000025065",
      po_amount: 2225000,
      project_title: "CIVIL WORKS",
      client_name: "RDS",
      location: null,
      payment_terms: "30 DAYS",
      cari: "RELEASED",
      cari_expiry: "2024-12-09",
      project_status: "COMPLETED",
      payment_status: "PAID",
      invoice_numbers: null,
      general_remarks: "  ",
    };
    expect(poMasterlistSheetRowsEqual(source, { ...source, po_amount: 2225000 })).toBe(
      true
    );
    expect(
      poMasterlistSheetRowsEqual(source, { ...source, project_title: "OTHER" })
    ).toBe(false);
  });
});
