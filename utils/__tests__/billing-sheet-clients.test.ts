import { describe, expect, it } from "vitest";
import {
  deriveClientCode,
  findBillingClientPoHeader,
  isRejectedBillingClientName,
  parseBillingSheetClientRows,
  preferredClientNameByPo,
  splitClientBusinessUnit,
  uniqueClientNames,
} from "@/lib/billing-sheet-clients";

describe("billing sheet CLIENT column parsing", () => {
  it("reads CLIENT from column G on INV# booklets and ignores NEED CARI yes/no", () => {
    const rows = [
      ["ADD-BELL INVOICES 2024"],
      [
        "STATUS",
        "INVOICE BOOKLET NO. (29)",
        "BILLING DATE",
        "AMOUNT",
        "P.O. NO.",
        "PROJECT TITLE",
        "CLIENT",
        "LOCATION",
        "NEED CARI?",
      ],
      [
        "COPY RECEIVED",
        "3402",
        "6-Jun-2024",
        "515000",
        "PO-RS13023434",
        "CIVIL WORKS",
        "ROBINSON'S SUPERMARKET",
        "RS GATEWAY CUBAO",
        "YES",
      ],
    ];
    const header = findBillingClientPoHeader(rows);
    expect(header).toMatchObject({ poIndex: 4, clientIndex: 6 });
    expect(parseBillingSheetClientRows(rows)).toEqual([
      { poNumber: "PO-RS13023434", clientName: "ROBINSON'S SUPERMARKET" },
    ]);
  });

  it("reads CLIENT from column I on L&K B-INV booklets", () => {
    const rows = [
      ["L&K BILLING INVOICES 2026"],
      [
        "STATUS",
        "INVOICE BOOKLET NO. (1)",
        "BILLING DATE",
        "P.O. AMOUNT",
        "WITH-HOLDING TAX",
        "TOTAL AMOUNT DUE",
        "P.O. NO.",
        "PROJECT TITLE",
        "CLIENT",
        "ATTENTION",
      ],
      [
        "COPY RECEIVED",
        "0501",
        "28-Mar-2026",
        "211680",
        "4233",
        "207446",
        "PHL20007342",
        "PREVENTIVE MAINTENANCE",
        "DHL SUPPLY CHAIN / ANALOG",
        "LOURDES MAGSINO",
      ],
    ];
    expect(parseBillingSheetClientRows(rows)).toEqual([
      { poNumber: "PHL20007342", clientName: "DHL SUPPLY CHAIN / ANALOG" },
    ]);
  });

  it("rejects yes/no and header leftovers, and prefers the most common client per P.O.", () => {
    expect(isRejectedBillingClientName("YES")).toBe(true);
    expect(isRejectedBillingClientName("NO")).toBe(true);
    expect(isRejectedBillingClientName("SKIPPED INVOICE")).toBe(true);
    expect(splitClientBusinessUnit("DHL SUPPLY CHAIN / ANALOG")).toEqual({
      name: "DHL SUPPLY CHAIN / ANALOG",
      businessUnit: "ANALOG",
    });
    const used = new Set<string>(["PUC"]);
    expect(deriveClientCode("Pick Up Coffee", used)).toBe("PUC2");
    expect(deriveClientCode("JLL PHILIPPINES, INC.", new Set())).toBe("JLL");
    const preferred = preferredClientNameByPo([
      { poNumber: "PO-1", clientName: "PICK UP COFFEE" },
      { poNumber: "PO-1", clientName: "PICK UP COFFEE" },
      { poNumber: "PO-1", clientName: "OTHER" },
    ]);
    expect(preferred.get("PO-1")).toBe("PICK UP COFFEE");
    expect(uniqueClientNames([{ poNumber: "A", clientName: "JLL" }, { poNumber: "B", clientName: "jll" }])).toEqual([
      "JLL",
    ]);
  });
});
