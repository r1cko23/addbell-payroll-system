import { describe, expect, it } from "vitest";
import {
  PO_MASTERLIST_GRID_COLUMNS,
  PO_MASTERLIST_WRAP_CELL_CLASS,
  PO_MASTERLIST_HEADER_CLASS,
  PO_MASTERLIST_CELL_ALIGN_CLASS,
} from "@/lib/po-masterlist-grid-columns";
import {
  PO_MASTERLIST_PAGE_SIZE,
  PO_MASTERLIST_PAGE_SIZES,
} from "@/lib/hooks/usePoMasterlistJobs";

describe("Projects spreadsheet columns", () => {
  it("uses P.O. NUMBER as the frozen identity column, not an ML- hash code", () => {
    const poColumn = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "po_number"
    );
    expect(poColumn).toMatchObject({
      key: "po_number",
      header: "P.O. NUMBER",
      frozen: true,
    });
    expect(
      PO_MASTERLIST_GRID_COLUMNS.some((col) => col.header === "Code")
    ).toBe(false);
  });

  it("hides received date, CARI, CARI expiry, and the Actions bar", () => {
    const headers = PO_MASTERLIST_GRID_COLUMNS.map((col) => col.header);
    expect(headers).not.toContain("P.O. RECEIVED DATE");
    expect(headers).not.toContain("CARI");
    expect(headers).not.toContain("CARI EXPIRY(DATE)");
    expect(headers).not.toContain("Actions");
  });

  it("keeps the glance columns in sheet order", () => {
    expect(PO_MASTERLIST_GRID_COLUMNS.map((col) => col.header)).toEqual([
      "P.O. DATE",
      "P.O. NUMBER",
      "P.O. AMOUNT",
      "PROJECT TITLE",
      "CLIENT",
      "LOCATION",
      "PAYMENT TERMS",
      "PROJECT STATUS",
      "PAYMENT STATUS",
      "INVOICE NO.",
      "GENERAL REMARKS",
    ]);
  });

  it("wraps title, client, location, and invoice text instead of cropping", () => {
    for (const key of ["project_title", "client_name", "location", "invoice_numbers"]) {
      const column = PO_MASTERLIST_GRID_COLUMNS.find((col) => col.key === key);
      expect(column?.wrap).toBe(true);
      expect(column?.truncate).toBeFalsy();
    }
    expect(PO_MASTERLIST_WRAP_CELL_CLASS).toContain("whitespace-normal");
    expect(PO_MASTERLIST_WRAP_CELL_CLASS).not.toContain("truncate");
  });

  it("lets title, client, location, and remarks take leftover width", () => {
    for (const key of [
      "project_title",
      "client_name",
      "location",
      "general_remarks",
    ]) {
      const column = PO_MASTERLIST_GRID_COLUMNS.find((col) => col.key === key);
      expect(column?.expand).toBe(true);
      expect(column?.truncate).toBeFalsy();
    }
  });

  it("assigns column widths that fill the row without forcing a horizontal scroll", () => {
    const widths = PO_MASTERLIST_GRID_COLUMNS.map((column) => {
      const match = column.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/);
      expect(match, `${column.key} needs a percent width`).toBeTruthy();
      return Number(match?.[1]);
    });
    const total = widths.reduce((sum, width) => sum + width, 0);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
    const title = PO_MASTERLIST_GRID_COLUMNS.find((col) => col.key === "project_title");
    const date = PO_MASTERLIST_GRID_COLUMNS.find((col) => col.key === "po_date");
    const titleWidth = Number(title?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]);
    const dateWidth = Number(date?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]);
    expect(titleWidth).toBeGreaterThan(dateWidth);
  });

  it("keeps PROJECT TITLE compact so a long description can wrap to three lines", () => {
    const title = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "project_title"
    );
    const titleWidth = Number(
      title?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]
    );
    expect(title?.wrap).toBe(true);
    expect(title?.truncate).toBeFalsy();
    expect(titleWidth).toBeGreaterThanOrEqual(17);
    expect(titleWidth).toBeLessThanOrEqual(21);
    expect(titleWidth).toBeGreaterThan(
      Number(
        PO_MASTERLIST_GRID_COLUMNS.find((col) => col.key === "client_name")
          ?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]
      )
    );
  });

  it("sizes P.O. DATE for 1-Jan through 31-Dec on one line and keeps payment terms compact", () => {
    const date = PO_MASTERLIST_GRID_COLUMNS.find((col) => col.key === "po_date");
    const invoice = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "invoice_numbers"
    );
    const terms = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "payment_terms"
    );
    const dateWidth = Number(date?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]);
    const invoiceWidth = Number(
      invoice?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]
    );
    const termsWidth = Number(
      terms?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]
    );
    expect(date?.wrap).toBeFalsy();
    expect(dateWidth).toBeGreaterThanOrEqual(6.5);
    expect(dateWidth).toBeLessThanOrEqual(7.5);
    expect(invoiceWidth).toBeGreaterThan(dateWidth);
    expect(termsWidth).toBeGreaterThanOrEqual(6.5);
    expect(termsWidth).toBeLessThanOrEqual(7.5);
    expect(termsWidth).toBeLessThanOrEqual(dateWidth);
  });

  it("narrows status chips and gives INVOICE NO. the room for stacked billing lines", () => {
    const projectStatus = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "project_status"
    );
    const paymentStatus = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "payment_status"
    );
    const invoice = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "invoice_numbers"
    );
    const projectWidth = Number(
      projectStatus?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]
    );
    const paymentWidth = Number(
      paymentStatus?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]
    );
    const invoiceWidth = Number(
      invoice?.widthClass?.match(/w-\[(\d+(?:\.\d+)?)%\]/)?.[1]
    );
    expect(projectWidth).toBeLessThanOrEqual(7.5);
    expect(paymentWidth).toBeLessThanOrEqual(8);
    expect(paymentWidth).toBeGreaterThanOrEqual(projectWidth);
    expect(invoiceWidth).toBeGreaterThanOrEqual(9);
    expect(invoiceWidth).toBeGreaterThan(projectWidth);
    expect(invoiceWidth).toBeGreaterThan(paymentWidth);
    expect(invoice?.wrap).toBe(true);
    expect(invoice?.expand).toBe(true);
    expect(invoice?.truncate).toBeFalsy();
  });

  it("centers header labels and cell contents", () => {
    expect(PO_MASTERLIST_CELL_ALIGN_CLASS).toContain("text-center");
    expect(PO_MASTERLIST_CELL_ALIGN_CLASS).toContain("align-middle");
    expect(PO_MASTERLIST_CELL_ALIGN_CLASS).not.toContain("text-left");
    expect(PO_MASTERLIST_CELL_ALIGN_CLASS).not.toContain("text-right");
  });

  it("lets PROJECT STATUS and PAYMENT STATUS wrap instead of colliding", () => {
    expect(PO_MASTERLIST_HEADER_CLASS).toContain("whitespace-normal");
    expect(PO_MASTERLIST_HEADER_CLASS).not.toContain("whitespace-nowrap");
  });

  it("wraps PAYMENT TERMS on the space, not through the T in PAYMENT", () => {
    expect(PO_MASTERLIST_HEADER_CLASS).toContain("break-normal");
    expect(PO_MASTERLIST_HEADER_CLASS).not.toContain("break-words");
    const terms = PO_MASTERLIST_GRID_COLUMNS.find(
      (col) => col.key === "payment_terms"
    );
    expect(terms?.header).toBe("PAYMENT TERMS");
  });

  it("pages the spreadsheet at 50 rows with 20/50/100 choices", () => {
    expect(PO_MASTERLIST_PAGE_SIZE).toBe(50);
    expect([...PO_MASTERLIST_PAGE_SIZES]).toEqual([20, 50, 100]);
  });
});
