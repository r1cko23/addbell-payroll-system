import { describe, expect, it } from "vitest";
import {
  findAddBellMasterlistHeader,
  mapAddBellProjectStatusToApp,
  parseAddBellMasterlistAmount,
  parseAddBellMasterlistDate,
  parseAddBellMasterlistRows,
  projectKeyFromTitleLocation,
} from "@/lib/po-masterlist-sheet-import";

const SAMPLE_ROWS = [
  ["ADD-BELL P.O. MASTERLIST 2024"],
  ["PERSON-IN-CHARGE: CRIS / PHEN"],
  [
    "P.O. DATE",
    "P.O. RECEIVED DATE",
    "P.O. NUMBER",
    "P.O. AMOUNT",
    "PROJECT TITLE",
    "CLIENT",
    "LOCATION",
    "PAYMENT TERMS",
    "CARI",
    "CARI EXPIRY\n(DATE)",
    "PROJECT STATUS",
    "PAYMENT STATUS",
    "INVOICE NO.",
    "GENERAL REMARKS\n*please indicate comments",
  ],
  [
    "15-Sep-2022",
    "19-Sep-2022",
    "130192343",
    "₱83,000.00",
    "CIVIL WORKS - REPAIR OF DRAINAGE MANHOLE",
    "ROBINSON'S SUPERMARKET",
    "RS RP PULILAN MALL",
    "30 DAYS",
    "N/A",
    "",
    "COMPLETED",
    "PAID",
    "205",
    "",
  ],
  [
    "15-Dec-2022",
    "24-Dec-2022",
    "RI 7000025065",
    "₱2,225,000.00",
    "CIVIL WORKS - TOILET IMPROVEMENT",
    "ROBINSON'S DEPARTMENT STORE",
    "RDS RP GALLERIA",
    "30 DAYS",
    "RELEASED",
    "9-Dec-2024",
    "COMPLETED",
    "PAID",
    "2996 (30%) - PAID",
    "note",
  ],
  [
    "1-Jan-2024",
    "",
    "",
    "₱10.00",
    "SKIP ME",
    "SOME CLIENT",
    "LOC",
    "",
    "",
    "",
    "PENDING",
    "",
    "",
    "",
  ],
];

describe("ADD-BELL masterlist import parsers", () => {
  it("finds the header row and column indexes including CARI EXPIRY with newline", () => {
    const header = findAddBellMasterlistHeader(SAMPLE_ROWS);
    expect(header).toMatchObject({
      headerRowIndex: 2,
      poNumber: 2,
      projectTitle: 4,
      client: 5,
      cariExpiry: 9,
      generalRemarks: 13,
    });
  });

  it("parses display dates and amounts", () => {
    expect(parseAddBellMasterlistDate("15-Sep-2022")).toBe("2022-09-15");
    expect(parseAddBellMasterlistDate("9-Dec-2024")).toBe("2024-12-09");
    expect(parseAddBellMasterlistDate("N/A")).toBeNull();
    expect(parseAddBellMasterlistDate("15-Sep-206")).toBeNull();
    expect(parseAddBellMasterlistDate("0206-09-15")).toBeNull();
    expect(parseAddBellMasterlistAmount("₱83,000.00")).toBe(83000);
    expect(parseAddBellMasterlistAmount("₱2,225,000.00")).toBe(2225000);
  });

  it("maps sheet project status into app statuses", () => {
    expect(mapAddBellProjectStatusToApp("COMPLETED")).toBe("completed");
    expect(mapAddBellProjectStatusToApp("CANCELLED")).toBe("on_hold");
    expect(mapAddBellProjectStatusToApp("PENDING")).toBe("pending");
    expect(mapAddBellProjectStatusToApp("")).toBe("active");
    expect(mapAddBellProjectStatusToApp("ON GOING")).toBe("active");
  });

  it("parses data rows with 1-based sheet_row and skips empty P.O. numbers", () => {
    const parsed = parseAddBellMasterlistRows(SAMPLE_ROWS);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      sheetTab: "ADD-BELL",
      sheetRow: 4,
      poNumber: "130192343",
      poDate: "2022-09-15",
      poAmount: 83000,
      clientName: "ROBINSON'S SUPERMARKET",
      projectStatus: "COMPLETED",
      appProjectStatus: "completed",
      invoiceNumbers: "205",
    });
    expect(parsed[1]).toMatchObject({
      sheetRow: 5,
      poNumber: "RI 7000025065",
      cari: "RELEASED",
      cariExpiry: "2024-12-09",
      generalRemarks: "note",
    });
  });

  it("builds stable project keys from title + location", () => {
    expect(
      projectKeyFromTitleLocation("CIVIL WORKS", "RS RP PULILAN MALL")
    ).toBe("civil works\u001frs rp pulilan mall");
  });
});
