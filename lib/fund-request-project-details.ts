import type { FundRequestRow } from "@/types/fund-request";

export type FundRequestProjectDetail = {
  po_number: string | null;
  title: string;
  location: string;
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
  completionPercentage: string;
};

export function createEmptyFundRequestProjectRow(): FundRequestProjectDetailRow {
  return { poNumber: "", title: "", location: "", completionPercentage: "" };
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

function normalizePoNumber(value: string): string {
  const trimmed = value.trim();
  return trimmed.toUpperCase() === "N/A" ? "N/A" : trimmed;
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
  >
): FundRequestProjectDetail[] {
  const raw = request.project_details as StoredFundRequestProjectDetails | null;

  if (raw && typeof raw === "object" && raw.v === 1 && Array.isArray(raw.projects)) {
    return raw.projects
      .filter(
        (project) =>
          project.title?.trim() ||
          project.location?.trim() ||
          project.po_number?.trim()
      )
      .map((project) => ({
        po_number: project.po_number?.trim() || null,
        title: project.title?.trim() ?? "",
        location: project.location?.trim() ?? "",
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
      row.completionPercentage.trim()
  );

  if (options.required && meaningfulRows.length === 0) {
    return options.requirePoPerProject
      ? "Add at least one project with P.O. number, title, location, and completion percentage."
      : "Add at least one project with title, location, and completion percentage.";
  }

  const partialRowIndex = meaningfulRows.findIndex((row) => {
    const hasPo = options.requirePoPerProject ? Boolean(row.poNumber.trim()) : true;
    const hasTitle = Boolean(row.title.trim());
    const hasLocation = Boolean(row.location.trim());
    const hasCompletion = Boolean(row.completionPercentage.trim());
    return !(hasPo && hasTitle && hasLocation && hasCompletion);
  });

  if (partialRowIndex >= 0) {
    return options.requirePoPerProject
      ? `Project ${partialRowIndex + 1} must include P.O. number, title, location, and completion percentage.`
      : `Project ${partialRowIndex + 1} must include title, location, and completion percentage.`;
  }

  for (let index = 0; index < meaningfulRows.length; index += 1) {
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
        row.completionPercentage.trim()
    )
    .map((row) => ({
      po_number: options?.includePoNumber
        ? normalizePoNumber(row.poNumber) || null
        : null,
      title: row.title.trim(),
      location: row.location.trim(),
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
  >
): string {
  const projects = parseFundRequestProjectDetails(request);
  if (projects.length === 0) return "—";
  if (projects.length === 1) return projects[0].title || "—";
  const first = projects[0].title || "Project";
  return `${first} (+${projects.length - 1} more)`;
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
