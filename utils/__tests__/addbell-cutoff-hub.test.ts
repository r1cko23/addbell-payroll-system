import { deriveAddbellCutoffHub } from "@/lib/payroll/addbell-cutoff-hub";

describe("deriveAddbellCutoffHub", () => {
  test("draft with no time entries starts at aggregate", () => {
    const hub = deriveAddbellCutoffHub({
      runStatus: "draft",
      scopedEmployees: 10,
      employeesWithClock: 0,
      missingRate: 0,
      zeroHours: 10,
      payslipCount: 0,
    });
    expect(hub.steps.find((step) => step.status === "current")?.id).toBe(
      "aggregate"
    );
    expect(hub.primary.id).toBe("aggregate");
    expect(hub.primary.label).toBe("Review attendance");
  });

  test("draft with hours and a missing rate stays on audit", () => {
    const hub = deriveAddbellCutoffHub({
      runStatus: "draft",
      scopedEmployees: 8,
      employeesWithClock: 8,
      missingRate: 1,
      zeroHours: 0,
      payslipCount: 0,
    });
    expect(hub.steps.find((step) => step.id === "audit")?.status).toBe(
      "attention"
    );
    expect(hub.primary.id).toBe("review_hours");
    expect(hub.checklist.find((check) => check.id === "rates")?.status).toBe(
      "warn"
    );
  });

  test("draft with hours and rates moves to build", () => {
    const hub = deriveAddbellCutoffHub({
      runStatus: "draft",
      scopedEmployees: 3,
      employeesWithClock: 3,
      missingRate: 0,
      zeroHours: 0,
      payslipCount: 0,
    });
    expect(hub.steps.find((step) => step.status === "current")?.id).toBe(
      "build"
    );
    expect(hub.primary.id).toBe("build");
    expect(hub.primary.label).toBe("Build payroll register");
  });

  test("processing with payslips moves to finalize", () => {
    const hub = deriveAddbellCutoffHub({
      runStatus: "processing",
      scopedEmployees: 4,
      employeesWithClock: 4,
      missingRate: 0,
      zeroHours: 0,
      payslipCount: 4,
    });
    expect(hub.steps.find((step) => step.status === "current")?.id).toBe(
      "finalize"
    );
    expect(hub.primary.id).toBe("finalize");
    expect(hub.steps.find((step) => step.id === "build")?.status).toBe(
      "complete"
    );
  });

  test("finalized cutoff opens downloads and marks earlier steps complete", () => {
    const hub = deriveAddbellCutoffHub({
      runStatus: "finalized",
      scopedEmployees: 2,
      employeesWithClock: 2,
      missingRate: 0,
      zeroHours: 0,
      payslipCount: 2,
    });
    expect(hub.steps.find((step) => step.status === "current")?.id).toBe(
      "downloads"
    );
    expect(
      hub.steps
        .filter((step) => step.id !== "downloads")
        .every((step) => step.status === "complete")
    ).toBe(true);
    expect(hub.primary.id).toBe("downloads");
  });
});
