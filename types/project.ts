export const PROJECT_STATUSES = [
  "active",
  "pending",
  "on_hold",
  "completed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  pending: "Pending",
  on_hold: "On Hold",
  completed: "Completed",
};

export const PROJECT_STATUS_COLORS: Record<
  ProjectStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  pending: "outline",
  on_hold: "secondary",
  completed: "default",
};

const LEGACY_STATUS_LABELS: Record<string, string> = {
  planned: "Pending",
  "on-hold": "On Hold",
  cancelled: "On Hold",
};

export function getProjectStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  if (status in PROJECT_STATUS_LABELS) {
    return PROJECT_STATUS_LABELS[status as ProjectStatus];
  }
  return LEGACY_STATUS_LABELS[status] ?? status.replace(/[-_]/g, " ");
}

export function getProjectStatusColor(
  status: string | null | undefined
): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  if (status in PROJECT_STATUS_COLORS) {
    return PROJECT_STATUS_COLORS[status as ProjectStatus];
  }
  if (status === "planned") return "outline";
  if (status === "on-hold" || status === "cancelled") return "secondary";
  return "outline";
}

export function normalizeProjectStatusFilter(status: string): string {
  if (status === "on-hold") return "on_hold";
  if (status === "planned") return "pending";
  return status;
}

export function projectMatchesStatusFilter(
  projectStatus: string,
  filter: string
): boolean {
  if (filter === "all") return true;
  const normalizedProjectStatus =
    projectStatus === "on-hold"
      ? "on_hold"
      : projectStatus === "planned"
        ? "pending"
        : projectStatus;
  return normalizedProjectStatus === filter;
}

export function getProjectDeleteDescription(projectName: string): string {
  return `This action cannot be undone. This will permanently delete "${projectName}" and all linked fund requests, purchase orders, assignments, progress records, and time entries.`;
}

export function getProjectDeleteErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

  if (message.includes("purchase_orders_project_id_fkey")) {
    return "This project cannot be deleted because purchase orders are still linked. Run the latest database migration to enable cascading deletes.";
  }
  if (message.includes("fund_requests_project_id_fkey")) {
    return "This project cannot be deleted because fund requests are still linked. Run the latest database migration to enable cascading deletes.";
  }
  if (message.includes("violates foreign key constraint")) {
    return "This project cannot be deleted because other records still reference it.";
  }
  return message || "Failed to delete project";
}
