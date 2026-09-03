import { describe, expect, test } from "vitest";
import {
  summarizeClientMasterlistJobs,
  type ClientMasterlistJobSummary,
} from "@/lib/client-masterlist-job-stats";

function job(
  overrides: Partial<ClientMasterlistJobSummary>
): ClientMasterlistJobSummary {
  return {
    id: overrides.id ?? "1",
    client_id: "c1",
    po_number: "PO1",
    project_title: null,
    location: null,
    po_amount: null,
    project_status: null,
    payment_status: null,
    po_date: null,
    ...overrides,
  };
}

describe("summarizeClientMasterlistJobs", () => {
  test("counts active, completed, and paid jobs", () => {
    const stats = summarizeClientMasterlistJobs([
      job({ id: "1", project_status: "ON-GOING", payment_status: "PENDING" }),
      job({ id: "2", project_status: "PENDING", payment_status: "FOR INVOICE" }),
      job({ id: "3", project_status: "COMPLETED", payment_status: "PAID" }),
      job({ id: "4", project_status: "COMPLETED", payment_status: "PENDING" }),
      job({ id: "5", project_status: "CANCELLED", payment_status: "CANCELLED" }),
    ]);

    expect(stats).toEqual({
      total: 5,
      active: 2,
      completed: 2,
      paid: 1,
    });
  });
});
