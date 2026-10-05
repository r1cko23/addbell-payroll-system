/**
 * Weekly payroll cutoff steps, matching the organic GP-HRIS hub:
 * aggregate attendance → audit hours → build register → finalize → downloads.
 */

export type AddbellCutoffStepId =
  | "aggregate"
  | "audit"
  | "build"
  | "finalize"
  | "downloads";

export type AddbellCutoffStepStatus =
  | "complete"
  | "current"
  | "upcoming"
  | "attention";

export type AddbellCutoffStep = {
  id: AddbellCutoffStepId;
  number: number;
  title: string;
  description: string;
  status: AddbellCutoffStepStatus;
  sectionId: string;
};

export type AddbellCutoffPrimaryActionId =
  | "aggregate"
  | "review_hours"
  | "build"
  | "finalize"
  | "downloads";

export type AddbellCutoffPrimaryAction = {
  id: AddbellCutoffPrimaryActionId;
  label: string;
  description: string;
  sectionId: string;
};

export type AddbellCutoffCheck = {
  id: string;
  label: string;
  detail: string;
  status: "pass" | "warn" | "pending";
  sectionId: string;
};

export type AddbellCutoffHubInput = {
  runStatus: string;
  scopedEmployees: number;
  employeesWithClock: number;
  missingRate: number;
  zeroHours: number;
  payslipCount: number;
};

const STEP_DEFS: Array<Omit<AddbellCutoffStep, "status">> = [
  {
    id: "aggregate",
    number: 1,
    title: "Aggregate",
    description: "Pull time entries into cutoff hours",
    sectionId: "cutoff-hours",
  },
  {
    id: "audit",
    number: 2,
    title: "Audit hours",
    description: "Review rates and hour buckets",
    sectionId: "cutoff-hours",
  },
  {
    id: "build",
    number: 3,
    title: "Build register",
    description: "Hours × rates to gross and deductions",
    sectionId: "payroll-register",
  },
  {
    id: "finalize",
    number: 4,
    title: "Finalize",
    description: "Lock this cutoff",
    sectionId: "payroll-register",
  },
  {
    id: "downloads",
    number: 5,
    title: "Downloads",
    description: "Export payroll and payslips",
    sectionId: "cutoff-downloads",
  },
];

function currentStepId(input: AddbellCutoffHubInput): AddbellCutoffStepId {
  const hasHours = input.employeesWithClock > 0 || input.payslipCount > 0;
  const hasRegister = input.payslipCount > 0;
  const flags = input.missingRate > 0 || input.zeroHours > 0;
  const status = input.runStatus;

  if (status === "finalized") return "downloads";
  if (hasRegister && (status === "processing" || status === "draft")) {
    return "finalize";
  }
  if (!hasHours) return "aggregate";
  if (flags) return "audit";
  return "build";
}

export function deriveAddbellCutoffHub(input: AddbellCutoffHubInput): {
  steps: AddbellCutoffStep[];
  primary: AddbellCutoffPrimaryAction;
  checklist: AddbellCutoffCheck[];
} {
  const current = currentStepId(input);
  const currentIdx = STEP_DEFS.findIndex((step) => step.id === current);
  const flags = input.missingRate > 0 || input.zeroHours > 0;
  const posted = input.runStatus === "finalized";

  const steps = STEP_DEFS.map((step, index) => {
    let status: AddbellCutoffStepStatus = "upcoming";
    if (posted && step.id !== "downloads") status = "complete";
    else if (posted && step.id === "downloads") status = "current";
    else if (index < currentIdx) status = "complete";
    else if (index === currentIdx) {
      status = step.id === "audit" && flags ? "attention" : "current";
    }
    return { ...step, status };
  });

  const primary = primaryAction(input, current);
  const checklist = [
    {
      id: "attendance",
      label: "Attendance",
      detail:
        input.employeesWithClock > 0
          ? `${input.employeesWithClock} employees have time entries`
          : "No time entries in this cutoff yet",
      status: input.employeesWithClock > 0 ? ("pass" as const) : ("pending" as const),
      sectionId: "cutoff-hours",
    },
    {
      id: "rates",
      label: "Pay rates",
      detail:
        input.missingRate > 0
          ? `${input.missingRate} missing a base rate`
          : "Every employee in scope has a rate",
      status: input.missingRate > 0 ? ("warn" as const) : ("pass" as const),
      sectionId: "cutoff-hours",
    },
    {
      id: "hours",
      label: "Hour rows",
      detail:
        input.zeroHours > 0
          ? `${input.zeroHours} with zero hours`
          : "No zero-hour rows",
      status: input.zeroHours > 0 ? ("warn" as const) : ("pass" as const),
      sectionId: "cutoff-hours",
    },
    {
      id: "register",
      label: "Register",
      detail:
        input.payslipCount > 0
          ? `${input.payslipCount} payslips built`
          : "Register not built yet",
      status: input.payslipCount > 0 ? ("pass" as const) : ("pending" as const),
      sectionId: "payroll-register",
    },
    {
      id: "finalized",
      label: "Finalized",
      detail: posted ? "Cutoff is locked" : "Still open",
      status: posted ? ("pass" as const) : ("pending" as const),
      sectionId: "cutoff-downloads",
    },
  ];

  return { steps, primary, checklist };
}

function primaryAction(
  input: AddbellCutoffHubInput,
  current: AddbellCutoffStepId
): AddbellCutoffPrimaryAction {
  if (current === "downloads") {
    return {
      id: "downloads",
      label: "Download payroll",
      description: "Export the payroll file and individual payslips.",
      sectionId: "cutoff-downloads",
    };
  }
  if (current === "finalize") {
    return {
      id: "finalize",
      label: "Finalize payroll",
      description: "Lock this cutoff after you spot-check the register.",
      sectionId: "payroll-register",
    };
  }
  if (current === "audit") {
    return {
      id: "review_hours",
      label: "Review flagged hours",
      description:
        "Fix missing base rates and zero-hour rows. You can still build the register; pay stays at zero until a rate is set.",
      sectionId: "cutoff-hours",
    };
  }
  if (current === "build") {
    return {
      id: "build",
      label: "Build payroll register",
      description: "Compute gross, deductions, and net from these hours.",
      sectionId: "payroll-register",
    };
  }
  return {
    id: "aggregate",
    label: "Review attendance",
    description:
      "Hours come from time entries for this Wed–Tue cutoff. Open Hours to see who punched.",
    sectionId: "cutoff-hours",
  };
}
