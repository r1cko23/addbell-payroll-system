import { describe, expect, it } from "vitest";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import { filterPoMasterlistJobs } from "@/lib/po-masterlist-job-filters";

function job(overrides: Partial<PoMasterlistJob>): PoMasterlistJob {
  return {
    id: overrides.id ?? "job-1",
    company_id: null,
    project_id: null,
    client_id: null,
    po_number: "TCP30001606",
    po_date: "2026-03-01",
    po_received_date: null,
    po_amount: 19800,
    project_title: "10FT X 10FT OPEN TENT",
    client_name: "TECHLOG CENTER, LLC",
    location: "ASURION TECHLOG CALAMBA",
    payment_terms: null,
    cari: null,
    cari_expiry: null,
    project_status: "COMPLETED",
    payment_status: "PAID",
    invoice_numbers: "440 (30%) - PAID",
    general_remarks: null,
    sheet_tab: "ADD-BELL",
    sheet_row: 10,
    sheet_synced_at: null,
    sheet_sync_error: null,
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("P.O. masterlist job filters", () => {
  const janLabor = job({
    id: "a",
    po_number: "5695518",
    project_title: "JAN '25 TECH LABOR",
    po_date: "2025-01-15",
    invoice_numbers: null,
    sheet_row: 186,
  });
  const febLabor = job({
    id: "b",
    po_number: "5695518",
    project_title: "FEB '25 TECH LABOR",
    po_date: "2025-02-15",
    sheet_row: 187,
  });
  const tent = job({ id: "c" });

  it("keeps monthly lines that share a P.O. as separate rows", () => {
    const rows = filterPoMasterlistJobs([janLabor, febLabor], {});
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("filters by year from P.O. date", () => {
    expect(
      filterPoMasterlistJobs([janLabor, tent], { years: [2026] }).map(
        (row) => row.id
      )
    ).toEqual(["c"]);
  });

  it("filters by client and project status", () => {
    const other = job({
      id: "d",
      client_name: "JLL PHILIPPINES, INC.",
      project_status: "ON-GOING",
    });
    expect(
      filterPoMasterlistJobs([tent, other], {
        clients: ["TECHLOG CENTER, LLC"],
        projectStatuses: ["COMPLETED"],
      }).map((row) => row.id)
    ).toEqual(["c"]);
  });

  it("search hits P.O. number, title, and invoice booklet number", () => {
    expect(
      filterPoMasterlistJobs([tent, janLabor], { q: "TCP30001606" }).map(
        (row) => row.id
      )
    ).toEqual(["c"]);
    expect(
      filterPoMasterlistJobs([tent, janLabor], { q: "OPEN TENT" }).map(
        (row) => row.id
      )
    ).toEqual(["c"]);
    expect(
      filterPoMasterlistJobs([tent, janLabor], { q: "440" }).map(
        (row) => row.id
      )
    ).toEqual(["c"]);
  });

  it("returns no rows when nothing matches", () => {
    expect(filterPoMasterlistJobs([tent], { q: "no-such-job" })).toEqual([]);
  });

  it("keeps every year when the year filter is empty, one year, or many years", () => {
    const jobs = [janLabor, tent];
    expect(filterPoMasterlistJobs(jobs, { years: [] }).map((row) => row.id)).toEqual(
      ["a", "c"]
    );
    expect(
      filterPoMasterlistJobs(jobs, { years: [2025] }).map((row) => row.id)
    ).toEqual(["a"]);
    expect(
      filterPoMasterlistJobs(jobs, { years: [2025, 2026] }).map((row) => row.id)
    ).toEqual(["a", "c"]);
  });

  it("filters by payment status", () => {
    const unpaid = job({
      id: "e",
      payment_status: "FOR INVOICE",
    });
    expect(
      filterPoMasterlistJobs([tent, unpaid], {
        paymentStatuses: ["PAID"],
      }).map((row) => row.id)
    ).toEqual(["c"]);
  });
});
