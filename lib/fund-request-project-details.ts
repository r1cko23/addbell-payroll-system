import type { FundRequestRow } from "@/types/fund-request";
import { isOfficeRelatedFundRequest } from "@/types/fund-request";

export type FundRequestProjectDetail = {
  po_number: string | null;
  title: string;
  location: string;
  po_amount: number | null;
  completion_percentage: number | null;
};

type StoredFundRequestProjectDetails = {
  v: 1;
  projects: FundRequestProjectDetail[];
};

export type FundRequestProjectDetailRow = {
  poNumber: string;
  title: string;
  location: string;
  poAmount: string;
  completionPercentage: string;
};

export function createEmptyFundRequestProjectRow(): FundRequestProjectDetailRow {
  return {
    poNumber: "",
    title: "",
    location: "",
    poAmount: "",
    completionPercentage: "",
  };
}

export function allowsMultipleFundRequestProjects(
  purposeOption: string
): boolean {
  return (
    purposeOption === "Project Funds" ||
    purposeOption === "Liquidation" ||
    purposeOption === "Others"
  );
}

export function usesFundRequestPerProjectPo(purposeOption: string): boolean {
  return (
    purposeOption === "Material Purchase" ||
    purposeOption === "Subcontractor Payment" ||
    allowsMultipleFundRequestProjects(purposeOption)
  );
}

function normalizePoNumber(value: string): string {
  const trimmed = value.trim();
  return trimmed.toUpperCase() === "N/A" ? "N/A" : trimmed;
}

function parsePoAmount(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function formatFundRequestPoAmount(
  value: number | string | null | undefined
): string {
  if (value == null || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return "—";
  return `₱${parsed.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function serializeFundRequestProjectDetails(
  projects: FundRequestProjectDetail[]
): StoredFundRequestProjectDetails | null {
  if (projects.length === 0) return null;
  return { v: 1, projects };
}

export function parseFundRequestProjectDetails(
  request: Pick<
    FundRequestRow,
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_number"
    | "po_amount"
  >
): FundRequestProjectDetail[] {
  const raw = request.project_details as StoredFundRequestProjectDetails | null;

  if (raw && typeof raw === "object" && raw.v === 1 && Array.isArray(raw.projects)) {
    return raw.projects
      .filter(
        (project) =>
          project.title?.trim() ||
          project.location?.trim() ||
          project.po_number?.trim() ||
          project.po_amount != null
      )
      .map((project) => ({
        po_number: project.po_number?.trim() || null,
        title: project.title?.trim() ?? "",
        location: project.location?.trim() ?? "",
        po_amount:
          project.po_amount == null ? null : Number(project.po_amount),
        completion_percentage:
          project.completion_percentage == null
            ? null
            : Number(project.completion_percentage),
      }));
  }

  if (request.project_title?.trim() || request.project_location?.trim()) {
    return [
      {
        po_number: request.po_number?.trim() || null,
        title: request.project_title?.trim() ?? "",
        location: request.project_location?.trim() ?? "",
        po_amount: request.po_amount,
        completion_percentage: request.current_project_percentage,
      },
    ];
  }

  return [];
}

export function validateFundRequestProjectRows(
  rows: FundRequestProjectDetailRow[],
  options: { required: boolean; requirePoPerProject?: boolean }
): string | null {
  const meaningfulRows = rows.filter(
    (row) =>
      row.poNumber.trim() ||
      row.title.trim() ||
      row.location.trim() ||
      row.poAmount.trim() ||
      row.completionPercentage.trim()
  );

  if (options.required && meaningfulRows.length === 0) {
    return options.requirePoPerProject
      ? "Add at least one project with P.O. number, title, location, P.O. amount, and completion percentage."
      : "Add at least one project with title, location, P.O. amount, and completion percentage.";
  }

  const partialRowIndex = meaningfulRows.findIndex((row) => {
    const hasPo = options.requirePoPerProject ? Boolean(row.poNumber.trim()) : true;
    const hasTitle = Boolean(row.title.trim());
    const hasLocation = Boolean(row.location.trim());
    const hasPoAmount = Boolean(row.poAmount.trim());
    const hasCompletion = Boolean(row.completionPercentage.trim());
    return !(hasPo && hasTitle && hasLocation && hasPoAmount && hasCompletion);
  });

  if (partialRowIndex >= 0) {
    return options.requirePoPerProject
      ? `Project ${partialRowIndex + 1} must include P.O. number, title, location, P.O. amount, and completion percentage.`
      : `Project ${partialRowIndex + 1} must include title, location, P.O. amount, and completion percentage.`;
  }

  for (let index = 0; index < meaningfulRows.length; index += 1) {
    const amount = parsePoAmount(meaningfulRows[index].poAmount);
    if (meaningfulRows[index].poAmount.trim() && amount == null) {
      return `Project ${index + 1} has an invalid P.O. amount.`;
    }

    const value = meaningfulRows[index].completionPercentage.trim().replace(/%$/, "");
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return `Project ${index + 1} has an invalid completion percentage.`;
    }
  }

  const blankRowIndex = rows.findIndex(
    (row) =>
      !row.poNumber.trim() &&
      !row.title.trim() &&
      !row.location.trim() &&
      !row.poAmount.trim() &&
      !row.completionPercentage.trim()
  );
  if (blankRowIndex >= 0 && rows.length > 1) {
    return `Project ${blankRowIndex + 1} is blank. Remove it or complete it.`;
  }

  return null;
}

export function normalizeFundRequestProjectRows(
  rows: FundRequestProjectDetailRow[],
  options?: { includePoNumber?: boolean }
): FundRequestProjectDetail[] {
  return rows
    .filter(
      (row) =>
        row.poNumber.trim() ||
        row.title.trim() ||
        row.location.trim() ||
        row.poAmount.trim() ||
        row.completionPercentage.trim()
    )
    .map((row) => ({
      po_number: options?.includePoNumber
        ? normalizePoNumber(row.poNumber) || null
        : null,
      title: row.title.trim(),
      location: row.location.trim(),
      po_amount: parsePoAmount(row.poAmount),
      completion_percentage: Number(
        row.completionPercentage.trim().replace(/%$/, "")
      ),
    }));
}

export function getFundRequestPrimaryProjectLabel(
  request: Pick<
    FundRequestRow,
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_number"
    | "po_amount"
  >
): string {
  const projects = parseFundRequestProjectDetails(request);
  if (projects.length === 0) return "—";
  if (projects.length === 1) return projects[0].title || "—";
  const first = projects[0].title || "Project";
  return `${first} (+${projects.length - 1} more)`;
}

export function getFundRequestListProjectLabel(
  request: Pick<
    FundRequestRow,
    | "reference_mode"
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_number"
    | "po_amount"
  >
): string {
  if (isOfficeRelatedFundRequest(request.reference_mode)) {
    return "Office-Related Request";
  }
  return getFundRequestPrimaryProjectLabel(request);
}

export function fundRequestUsesPerProjectPo(
  request: Pick<FundRequestRow, "project_details">
): boolean {
  const raw = request.project_details as StoredFundRequestProjectDetails | null;
  if (raw && typeof raw === "object" && raw.v === 1 && Array.isArray(raw.projects)) {
    return raw.projects.some((project) => Boolean(project.po_number?.trim()));
  }
  return false;
}
