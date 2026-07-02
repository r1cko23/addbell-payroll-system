import {
  getFundRequestSubmissionWorkflow,
  isPurchasingOfficerSelfSubmitPath,
  requesterRequiresOperationsManagerApproval,
  resolveFundRequestRequesterRouting,
} from "@/lib/fund-request-routing";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("requesterRequiresOperationsManagerApproval", () => {
  test("requires OM approval only when group approver is operations manager", () => {
    expect(
      requesterRequiresOperationsManagerApproval({
        overtimeGroupId: "group-1",
        groupApproverRole: "operations_manager",
      })
    ).toBe(true);
    expect(
      requesterRequiresOperationsManagerApproval({
        overtimeGroupId: "group-1",
        groupApproverRole: "purchasing_officer",
      })
    ).toBe(false);
    expect(
      requesterRequiresOperationsManagerApproval({
        overtimeGroupId: null,
        groupApproverRole: "operations_manager",
      })
    ).toBe(false);
  });
});

describe("resolveFundRequestRequesterRouting", () => {
  test("loads group approver via separate queries (no PostgREST embed)", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "employees") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { overtime_group_id: "group-1" },
                }),
              }),
            }),
          };
        }
        if (table === "overtime_groups") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "group-1",
                    name: "Operations-Laguna",
                    approver_id: "om-user",
                  },
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { role: "operations_manager", full_name: "Constantino Milo" },
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    await expect(
      resolveFundRequestRequesterRouting(supabase, "employee-1")
    ).resolves.toEqual({
      overtimeGroupId: "group-1",
      overtimeGroupName: "Operations-Laguna",
      groupApproverUserId: "om-user",
      groupApproverRole: "operations_manager",
      groupApproverName: "Constantino Milo",
      requiresOperationsManagerApproval: true,
    });
  });
});

describe("getFundRequestSubmissionWorkflow", () => {
  test("skips OM for requesters not under an operations manager", () => {
    expect(
      getFundRequestSubmissionWorkflow({
        submitterRole: "hr",
        isPortal: false,
        submitterUserId: "user-1",
        requiresOperationsManagerApproval: false,
      }).status
    ).toBe("project_manager_approved");
  });

  test("starts at pending when requester is under an operations manager", () => {
    expect(
      getFundRequestSubmissionWorkflow({
        submitterRole: "employee",
        isPortal: true,
        submitterUserId: "user-1",
        requiresOperationsManagerApproval: true,
      }).status
    ).toBe("pending");
  });
});

describe("isPurchasingOfficerSelfSubmitPath", () => {
  test("requires bank details on dashboard self-submit only", () => {
    expect(
      isPurchasingOfficerSelfSubmitPath({
        submitterRole: "purchasing_officer",
        isPortal: false,
        submitterUserId: "user-1",
      })
    ).toBe(true);
    expect(
      isPurchasingOfficerSelfSubmitPath({
        submitterRole: "purchasing_officer",
        isPortal: true,
        submitterUserId: "user-1",
      })
    ).toBe(false);
    expect(
      isPurchasingOfficerSelfSubmitPath({
        submitterRole: "purchasing_officer",
        isPortal: true,
        submitterUserId: "user-1",
        isOwnEmployeeRequest: true,
      })
    ).toBe(true);
    expect(
      isPurchasingOfficerSelfSubmitPath({
        submitterRole: "hr",
        isPortal: false,
        submitterUserId: "user-1",
      })
    ).toBe(false);
  });
});

describe("getFundRequestSubmissionWorkflow purchasing officer self-submit", () => {
  test("skips PO queue for PO filing own request from portal", () => {
    const workflow = getFundRequestSubmissionWorkflow({
      submitterRole: "purchasing_officer",
      isPortal: true,
      submitterUserId: "po-user",
      requiresOperationsManagerApproval: false,
      isOwnEmployeeRequest: true,
    });
    expect(workflow.status).toBe("purchasing_officer_approved");
    expect(workflow.purchasing_officer_approved_by).toBe("po-user");
    expect(workflow.purchasing_officer_approved_at).toBeTruthy();
  });
});
