import {
  getFundRequestSubmissionWorkflow,
  isPurchasingOfficerSelfSubmitPath,
  requesterRequiresOperationsManagerApproval,
} from "@/lib/fund-request-routing";

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
        submitterRole: "hr",
        isPortal: false,
        submitterUserId: "user-1",
      })
    ).toBe(false);
  });
});
