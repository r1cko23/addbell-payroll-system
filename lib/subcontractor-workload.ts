export type SubcontractorJobRow = {
  poId: string;
  vendorId: string;
  poNumber: string;
  projectId: string | null;
  projectName: string;
  projectStatus: string | null;
  poStatus: string | null;
};

export type SubcontractorWorkloadStats = {
  /** Unique open jobs/projects still on the subcon’s plate */
  active: number;
  /** Unique completed jobs/projects */
  completed: number;
  /** Active + completed unique jobs */
  total: number;
  jobs: SubcontractorJobRow[];
};

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/-/g, "_");
}

/** Project still open — not finished, so it counts against capacity. */
export function isOpenSubcontractorProjectStatus(
  status: string | null | undefined
): boolean {
  const normalized = normalizeStatus(status);
  return (
    normalized === "active" ||
    normalized === "pending" ||
    normalized === "on_hold" ||
    normalized === "on_going" ||
    normalized === "ongoing" ||
    normalized === ""
  );
}

export function isCompletedSubcontractorProjectStatus(
  status: string | null | undefined
): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "completed" || normalized === "complete" || normalized === "done";
}

function jobIdentityKey(job: SubcontractorJobRow): string {
  return job.projectId ? `job:${job.projectId}` : `po:${job.poId}`;
}

export function summarizeSubcontractorWorkload(
  jobs: SubcontractorJobRow[]
): SubcontractorWorkloadStats {
  const activeKeys = new Set<string>();
  const completedKeys = new Set<string>();

  for (const job of jobs) {
    const key = jobIdentityKey(job);
    if (isCompletedSubcontractorProjectStatus(job.projectStatus)) {
      completedKeys.add(key);
    } else if (isOpenSubcontractorProjectStatus(job.projectStatus)) {
      activeKeys.add(key);
    }
  }

  return {
    active: activeKeys.size,
    completed: completedKeys.size,
    total: activeKeys.size + completedKeys.size,
    jobs,
  };
}

export function emptySubcontractorWorkload(): SubcontractorWorkloadStats {
  return { active: 0, completed: 0, total: 0, jobs: [] };
}
