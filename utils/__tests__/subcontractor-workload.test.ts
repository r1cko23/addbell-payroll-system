import { describe, expect, test } from "vitest";
import {
  summarizeSubcontractorWorkload,
  type SubcontractorJobRow,
} from "@/lib/subcontractor-workload";

function job(
  overrides: Partial<SubcontractorJobRow>
): SubcontractorJobRow {
  return {
    poId: overrides.poId ?? "po1",
    vendorId: "v1",
    poNumber: "PO-1",
    projectId: overrides.projectId ?? "p1",
    projectName: "Project",
    projectStatus: null,
    poStatus: "approved",
    ...overrides,
  };
}

describe("summarizeSubcontractorWorkload", () => {
  test("counts unique open vs completed projects", () => {
    const stats = summarizeSubcontractorWorkload([
      job({ poId: "1", projectId: "a", projectStatus: "active" }),
      job({ poId: "2", projectId: "a", projectStatus: "active" }),
      job({ poId: "3", projectId: "b", projectStatus: "pending" }),
      job({ poId: "4", projectId: "c", projectStatus: "on_hold" }),
      job({ poId: "5", projectId: "d", projectStatus: "completed" }),
      job({ poId: "6", projectId: null, projectStatus: null }),
    ]);

    expect(stats.active).toBe(4);
    expect(stats.completed).toBe(1);
    expect(stats.total).toBe(5);
  });
});
