import { describe, expect, it } from "vitest";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import {
  FOR_COMPLETION_OF_DETAILS,
  buildInternalPoMasterlistLink,
  catalogProjectIdForInternalPo,
  fillInternalPurchaseOrderFromMasterlistJob,
  formatInternalPoJobPickerLabel,
  internalPoLinkLabel,
  internalPoSaveError,
  matchesInternalPoJobSearch,
  purchaseOrderVendorLabel,
} from "@/lib/purchase-order-job-fill";

function job(overrides: Partial<PoMasterlistJob> = {}): PoMasterlistJob {
  return {
    id: "job-1",
    company_id: null,
    project_id: "catalog-project-1",
    client_id: null,
    po_number: "TCP30001606",
    po_date: "2026-03-01",
    po_received_date: null,
    po_amount: 19800,
    project_title: "10FT X 10FT OPEN TENT",
    client_name: "TECHLOG CENTER, LLC",
    location: "ASURION TECHLOG CALAMBA",
    payment_terms: "30% Down Payment\n70% Progress Billing",
    cari: null,
    cari_expiry: null,
    project_status: "ON-GOING",
    payment_status: "FOR INVOICE",
    invoice_numbers: "440 (30%) - PAID",
    general_remarks: null,
    sheet_tab: "ADD-BELL",
    sheet_row: 10,
    sheet_synced_at: null,
    sheet_sync_error: null,
    sheet_sync_fingerprint: null,
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("internal PO fill from masterlist job", () => {
  it("copies title, location, catalog project, and payment terms — not the client P.O. as the internal number", () => {
    const fill = fillInternalPurchaseOrderFromMasterlistJob(job());
    expect(fill).toEqual({
      catalogProjectId: "catalog-project-1",
      masterlistJobId: "job-1",
      clientPoNumber: "TCP30001606",
      projectTitle: "10FT X 10FT OPEN TENT",
      deliverTo: "ASURION TECHLOG CALAMBA",
      paymentTerms: ["30% Down Payment", "70% Progress Billing"],
    });
  });

  it("leaves payment terms unset when the job has none so the form keeps its defaults", () => {
    expect(
      fillInternalPurchaseOrderFromMasterlistJob(job({ payment_terms: null }))
        .paymentTerms
    ).toBeNull();
    expect(
      fillInternalPurchaseOrderFromMasterlistJob(job({ payment_terms: "   " }))
        .paymentTerms
    ).toBeNull();
  });

  it("keeps a missing catalog link as null so save can resolve it later", () => {
    expect(
      fillInternalPurchaseOrderFromMasterlistJob(job({ project_id: null }))
        .catalogProjectId
    ).toBeNull();
  });

  it("treats a blank title or location as empty strings, not placeholders", () => {
    const fill = fillInternalPurchaseOrderFromMasterlistJob(
      job({ project_title: null, location: "  " })
    );
    expect(fill.projectTitle).toBe("");
    expect(fill.deliverTo).toBe("");
  });
});

describe("internal PO job search", () => {
  const tent = job();
  const labor = job({
    id: "job-2",
    po_number: "5695518",
    project_title: "JAN '25 TECH LABOR",
    location: "BGC SITE",
    client_name: "JLL PHILIPPINES, INC.",
    invoice_numbers: "1675 (30%)",
  });

  it("blank query matches every job, including a one-job and empty list", () => {
    expect(matchesInternalPoJobSearch(tent, "")).toBe(true);
    expect(matchesInternalPoJobSearch(tent, "   ")).toBe(true);
    expect([].filter((row) => matchesInternalPoJobSearch(row, ""))).toEqual([]);
  });

  it("finds by P.O. number, title, or location and not by client or invoice only", () => {
    expect(matchesInternalPoJobSearch(tent, "tcp30001606")).toBe(true);
    expect(matchesInternalPoJobSearch(tent, "open tent")).toBe(true);
    expect(matchesInternalPoJobSearch(tent, "calamba")).toBe(true);
    expect(matchesInternalPoJobSearch(tent, "TECHLOG CENTER")).toBe(false);
    expect(matchesInternalPoJobSearch(tent, "440")).toBe(false);
    expect(
      [tent, labor].filter((row) => matchesInternalPoJobSearch(row, "bgc"))
    ).toEqual([labor]);
  });

  it("returns no matches when nothing hits the three search fields", () => {
    expect(matchesInternalPoJobSearch(tent, "no-such-job")).toBe(false);
  });
});

describe("internal PO job picker label", () => {
  it("shows P.O. number, title, and location for a complete job", () => {
    expect(formatInternalPoJobPickerLabel(job())).toBe(
      "TCP30001606 · 10FT X 10FT OPEN TENT · ASURION TECHLOG CALAMBA"
    );
  });

  it("omits blank title or location instead of leaving empty dots", () => {
    expect(
      formatInternalPoJobPickerLabel(
        job({ project_title: null, location: "" })
      )
    ).toBe("TCP30001606");
  });
});

describe("internal PO catalog project id", () => {
  it("uses the job link, then a code lookup, and stays null when both are missing", () => {
    expect(catalogProjectIdForInternalPo(job(), "other")).toBe(
      "catalog-project-1"
    );
    expect(
      catalogProjectIdForInternalPo(job({ project_id: null }), "looked-up")
    ).toBe("looked-up");
    expect(
      catalogProjectIdForInternalPo(job({ project_id: null }), null)
    ).toBeNull();
  });
});

describe("internal PO project source", () => {
  it("links a selected masterlist job, and tags an unlinked PO for completion of details", () => {
    expect(buildInternalPoMasterlistLink(job())).toEqual({
      po_masterlist_job_id: "job-1",
      masterlist_link_status: "linked",
      masterlist_link_note: null,
    });
    expect(buildInternalPoMasterlistLink(null)).toEqual({
      po_masterlist_job_id: null,
      masterlist_link_status: "needs_review",
      masterlist_link_note: FOR_COMPLETION_OF_DETAILS,
    });
  });

  it("labels unlinked POs for later linking, including zero and one linked job", () => {
    expect(internalPoLinkLabel(buildInternalPoMasterlistLink(null))).toBe(
      "For completion of details"
    );
    expect(internalPoLinkLabel(buildInternalPoMasterlistLink(job()))).toBe(
      "Linked"
    );
    expect(
      internalPoLinkLabel({
        masterlist_link_status: null,
        masterlist_link_note: null,
      })
    ).toBeNull();
  });
});

describe("internal PO save guard", () => {
  const vendorOk = {
    vendorId: "vendor-1",
    poNumber: "PROJ-VEND-2026-0001",
    projectTitle: "Site electrical",
  };

  it("allows an unlinked PO when title is filled, and a linked PO with a job even if title is blank", () => {
    expect(
      internalPoSaveError({
        ...vendorOk,
        selectedJob: null,
      })
    ).toBeNull();
    expect(
      internalPoSaveError({
        ...vendorOk,
        selectedJob: { id: "job-1" },
      })
    ).toBeNull();
    expect(
      internalPoSaveError({
        ...vendorOk,
        projectTitle: "",
        selectedJob: { id: "job-1" },
      })
    ).toBeNull();
  });

  it("requires a project title when nothing is linked, and still requires vendor and PO number", () => {
    expect(
      internalPoSaveError({
        ...vendorOk,
        projectTitle: "  ",
        selectedJob: null,
      })
    ).toBe("Enter a project title.");
    expect(
      internalPoSaveError({
        vendorId: "",
        poNumber: "X",
        projectTitle: "A",
        selectedJob: null,
      })
    ).toBe("Select or add a vendor.");
    expect(
      internalPoSaveError({
        vendorId: "vendor-1",
        poNumber: "  ",
        projectTitle: "A",
        selectedJob: null,
      })
    ).toBe("Generate a PO number first.");
  });

  it("rejects a typed vendor name when no vendor record is selected", () => {
    expect(
      internalPoSaveError({
        vendorId: "",
        vendorName: "Acme Supply Co",
        poNumber: "ADDPO-2609-0101",
        projectTitle: "Site electrical",
        selectedJob: null,
      })
    ).toBe("Select or add a vendor.");
    expect(
      internalPoSaveError({
        vendorId: "   ",
        vendorName: "Acme Supply Co",
        poNumber: "ADDPO-2609-0101",
        projectTitle: "Site electrical",
        selectedJob: null,
      })
    ).toBe("Select or add a vendor.");
  });
});

describe("purchase order vendor label", () => {
  it("uses the listed vendor, then a manual snapshot name, then an em dash", () => {
    expect(
      purchaseOrderVendorLabel({
        vendors: { name: "3GEE SYSTEM SOLUTIONS" },
        vendor_snapshot: { name: "Ignored" },
      })
    ).toBe("3GEE SYSTEM SOLUTIONS");
    expect(
      purchaseOrderVendorLabel({
        vendors: null,
        vendor_snapshot: { name: "Acme Supply Co" },
      })
    ).toBe("Acme Supply Co");
    expect(purchaseOrderVendorLabel({ vendors: null, vendor_snapshot: null })).toBe(
      "—"
    );
    expect(
      purchaseOrderVendorLabel({
        vendors: { name: "  " },
        vendor_snapshot: { name: "  " },
      })
    ).toBe("—");
  });
});
