import { describe, expect, it } from "vitest";
import {
  formatFundRequestPoAmount,
  parseFundRequestProjectDetails,
} from "@/lib/fund-request-project-details";
import type { FundRequestRow } from "@/types/fund-request";

function requestWithProjects(
  projects: Array<{
    po_number: string;
    title: string;
    location: string;
    po_amount: number | null;
    completion_percentage: number;
  }>
): Pick<
  FundRequestRow,
  | "project_details"
  | "project_title"
  | "project_location"
  | "current_project_percentage"
  | "po_number"
  | "po_amount"
> {
  return {
    project_details: { v: 1, projects },
    project_title: projects[0]?.title ?? null,
    project_location: projects[0]?.location ?? null,
    current_project_percentage: projects[0]?.completion_percentage ?? null,
    po_number: projects[0]?.po_number ?? null,
    po_amount: projects[0]?.po_amount ?? null,
  };
}

describe("parseFundRequestProjectDetails", () => {
  it("keeps each P.O. amount on multi-PO requests", () => {
    const projects = parseFundRequestProjectDetails(
      requestWithProjects([
        {
          po_number: "PO-1",
          title: "Job A",
          location: "Naga",
          po_amount: 1100000,
          completion_percentage: 100,
        },
        {
          po_number: "PO-2",
          title: "Job B",
          location: "Imus",
          po_amount: 6500000,
          completion_percentage: 40,
        },
      ])
    );

    expect(projects).toHaveLength(2);
    expect(projects.map((project) => project.po_amount)).toEqual([1100000, 6500000]);
    expect(formatFundRequestPoAmount(projects[1].po_amount)).toContain("6,500,000");
  });
});
