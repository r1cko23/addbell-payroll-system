import { describe, expect, it } from "vitest";
import {
  buildFundRequestUmProjectDetailsUpdates,
  canUpperManagementEditProjectDetails,
} from "@/lib/fund-request-um-project-details";
import type { FundRequestProjectDetailRow } from "@/lib/fund-request-project-details";

describe("canUpperManagementEditProjectDetails", () => {
  it("allows upper management at final review", () => {
    expect(
      canUpperManagementEditProjectDetails(
        "upper_management",
        "purchasing_officer_approved"
      )
    ).toBe(true);
  });

  it("allows admin at final review", () => {
    expect(
      canUpperManagementEditProjectDetails("admin", "purchasing_officer_approved")
    ).toBe(true);
  });

  it("blocks upper management before purchasing has approved", () => {
    expect(
      canUpperManagementEditProjectDetails(
        "upper_management",
        "project_manager_approved"
      )
    ).toBe(false);
  });

  it("blocks upper management after final approval", () => {
    expect(
      canUpperManagementEditProjectDetails(
        "upper_management",
        "management_approved"
      )
    ).toBe(false);
  });

  it("blocks purchasing officer at UM review status", () => {
    expect(
      canUpperManagementEditProjectDetails(
        "purchasing_officer",
        "purchasing_officer_approved"
      )
    ).toBe(false);
  });

  it("blocks operations manager at UM review status", () => {
    expect(
      canUpperManagementEditProjectDetails(
        "operations_manager",
        "purchasing_officer_approved"
      )
    ).toBe(false);
  });
});

describe("buildFundRequestUmProjectDetailsUpdates", () => {
  const singleRow: FundRequestProjectDetailRow[] = [
    {
      poNumber: "PO-RE1350009232",
      title: "Interior Construction",
      location: "RE The Alcove",
      poAmount: "4800000",
      completionPercentage: "25",
    },
  ];

  it("writes one project's fields to top-level columns and project_details", () => {
    const updates = buildFundRequestUmProjectDetailsUpdates(singleRow, null);

    expect(updates).toEqual({
      po_number: "PO-RE1350009232",
      project_title: "Interior Construction",
      project_location: "RE The Alcove",
      po_amount: 4800000,
      current_project_percentage: 25,
      project_details: {
        v: 1,
        projects: [
          {
            po_number: "PO-RE1350009232",
            title: "Interior Construction",
            location: "RE The Alcove",
            po_amount: 4800000,
            completion_percentage: 25,
          },
        ],
      },
    });
  });

  it("keeps each project when many are edited", () => {
    const updates = buildFundRequestUmProjectDetailsUpdates(
      [
        {
          poNumber: "PO-1",
          title: "Job A",
          location: "Naga",
          poAmount: "1000",
          completionPercentage: "10",
        },
        {
          poNumber: "PO-2",
          title: "Job B",
          location: "Imus",
          poAmount: "2000",
          completionPercentage: "40",
        },
      ],
      null
    );

    expect(updates.po_number).toBe("PO-1");
    expect(updates.project_title).toBe("Job A");
    expect(updates.project_details).toEqual({
      v: 1,
      projects: [
        {
          po_number: "PO-1",
          title: "Job A",
          location: "Naga",
          po_amount: 1000,
          completion_percentage: 10,
        },
        {
          po_number: "PO-2",
          title: "Job B",
          location: "Imus",
          po_amount: 2000,
          completion_percentage: 40,
        },
      ],
    });
  });

  it("preserves progress billing on an existing project_details payload", () => {
    const updates = buildFundRequestUmProjectDetailsUpdates(singleRow, {
      v: 1,
      projects: [
        {
          po_number: "OLD",
          title: "Old",
          location: "Old Loc",
          po_amount: 1,
          completion_percentage: 0,
        },
      ],
      progress_billing: {
        payment_scheme: "Progress Billing",
        milestone: "1st Billing",
        invoice_number: "INV-1",
      },
    });

    expect(updates.project_details).toMatchObject({
      v: 1,
      progress_billing: {
        payment_scheme: "Progress Billing",
        milestone: "1st Billing",
        invoice_number: "INV-1",
      },
    });
  });

  it("returns null when validation fails", () => {
    expect(
      buildFundRequestUmProjectDetailsUpdates(
        [
          {
            poNumber: "",
            title: "Only title",
            location: "",
            poAmount: "",
            completionPercentage: "",
          },
        ],
        null
      )
    ).toBeNull();
  });
});
