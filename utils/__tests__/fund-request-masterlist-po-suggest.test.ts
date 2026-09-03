import { describe, expect, it } from "vitest";
import {
  fundRequestMasterlistSuggestHints,
  rankMasterlistJobsForFundRequestHints,
} from "@/lib/fund-request-masterlist-po-suggest";

describe("rankMasterlistJobsForFundRequestHints", () => {
  const jobs = [
    {
      id: "1",
      po_number: "PO-RE1350009999",
      project_title: "SIGNAGE SUPPORT",
      location: "RS RP LAS PINAS",
      po_amount: 140000,
      client_name: "Client A",
    },
    {
      id: "2",
      po_number: "PO-OTHER",
      project_title: "Warehouse Fit-out",
      location: "Makati",
      po_amount: 50000,
      client_name: "Client B",
    },
    {
      id: "3",
      po_number: "PO-AMOUNT-ONLY",
      project_title: "Something else",
      location: "Elsewhere",
      po_amount: 140000,
      client_name: "Client C",
    },
  ];

  it("ranks by title, location, and amount", () => {
    const ranked = rankMasterlistJobsForFundRequestHints(jobs, {
      title: "SUGNAGE SUPPORT",
      location: "RS RP LASPINAS",
      poAmount: 140000,
    });
    expect(ranked.length).toBeGreaterThan(0);
    // Title typo still shares SUPPORT; location + amount should favor job 1
    expect(ranked[0]?.po_number).toBe("PO-RE1350009999");
    expect(ranked[0]?.reasons.some((r) => r.includes("amount"))).toBe(true);
  });

  it("returns exact title matches first", () => {
    const ranked = rankMasterlistJobsForFundRequestHints(jobs, {
      title: "SIGNAGE SUPPORT",
      location: null,
      poAmount: null,
    });
    expect(ranked[0]?.po_number).toBe("PO-RE1350009999");
    expect(ranked[0]?.reasons).toContain("exact title");
  });
});

describe("fundRequestMasterlistSuggestHints", () => {
  it("reads primary project row", () => {
    const hints = fundRequestMasterlistSuggestHints({
      po_number: "No PO, with NTP",
      project_title: null,
      project_location: null,
      current_project_percentage: null,
      po_amount: null,
      project_details: {
        v: 1,
        projects: [
          {
            po_number: "No PO, with NTP",
            title: "SUGNAGE SUPPORT",
            location: "RS RP LASPINAS",
            po_amount: 140000,
            completion_percentage: 100,
          },
        ],
      },
    });
    expect(hints.title).toBe("SUGNAGE SUPPORT");
    expect(hints.location).toBe("RS RP LASPINAS");
    expect(hints.poAmount).toBe(140000);
  });
});
