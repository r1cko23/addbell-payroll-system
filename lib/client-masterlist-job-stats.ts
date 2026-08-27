export type ClientMasterlistJobSummary = {
  id: string;
  client_id: string | null;
  po_number: string;
  project_title: string | null;
  location: string | null;
  po_amount: number | null;
  project_status: string | null;
  payment_status: string | null;
  po_date: string | null;
};

export type ClientJobStats = {
  total: number;
  /** ON-GOING + PENDING project status */
  active: number;
  /** COMPLETED project status */
  completed: number;
  /** PAID payment status */
  paid: number;
};

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function isActiveMasterlistJobStatus(status: string | null | undefined): boolean {
  const normalized = normalizeStatus(status);
  return (
    normalized === "ON-GOING" ||
    normalized === "ONGOING" ||
    normalized === "PENDING"
  );
}

export function isCompletedMasterlistJobStatus(
  status: string | null | undefined
): boolean {
  return normalizeStatus(status) === "COMPLETED";
}

export function isPaidMasterlistJobStatus(status: string | null | undefined): boolean {
  return normalizeStatus(status) === "PAID";
}

export function summarizeClientMasterlistJobs(
  jobs: ClientMasterlistJobSummary[]
): ClientJobStats {
  let active = 0;
  let completed = 0;
  let paid = 0;

  for (const job of jobs) {
    if (isActiveMasterlistJobStatus(job.project_status)) active += 1;
    if (isCompletedMasterlistJobStatus(job.project_status)) completed += 1;
    if (isPaidMasterlistJobStatus(job.payment_status)) paid += 1;
  }

  return {
    total: jobs.length,
    active,
    completed,
    paid,
  };
}
