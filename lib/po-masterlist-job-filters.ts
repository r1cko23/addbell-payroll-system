import type { PoMasterlistJob } from "@/types/po-masterlist";

export const PO_MASTERLIST_MIN_YEAR = 2022;

export type PoMasterlistJobListFilters = {
  q?: string;
  projectStatuses?: string[];
  paymentStatuses?: string[];
  clients?: string[];
  years?: number[];
};

export function isPlausiblePoYear(year: number): boolean {
  const maxYear = new Date().getFullYear() + 1;
  return Number.isFinite(year) && year >= PO_MASTERLIST_MIN_YEAR && year <= maxYear;
}

export function yearFromPoDate(poDate: string | null | undefined): number | null {
  if (!poDate) return null;
  const match = /^(\d{4})/.exec(poDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  return isPlausiblePoYear(year) ? year : null;
}

function clientIdentityKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesAnyStatus(
  value: string | null | undefined,
  selected: string[],
  ongoingAlias = false
): boolean {
  if (selected.length === 0) return true;
  const normalized = (value ?? "").trim().toUpperCase();
  return selected.some((filter) => {
    const needle = filter.trim().toUpperCase();
    if (
      ongoingAlias &&
      (needle === "ON-GOING" || needle === "ONGOING")
    ) {
      return normalized === "ON-GOING" || normalized === "ONGOING";
    }
    return normalized === needle;
  });
}

export function filterPoMasterlistJobs(
  jobs: PoMasterlistJob[],
  filters: PoMasterlistJobListFilters
): PoMasterlistJob[] {
  const query = filters.q?.trim().toLowerCase() ?? "";
  const selectedYears = new Set(filters.years ?? []);
  const selectedClients = new Set(
    (filters.clients ?? []).map((client) => clientIdentityKey(client)).filter(Boolean)
  );

  return jobs.filter((job) => {
    if (
      !matchesAnyStatus(job.project_status, filters.projectStatuses ?? [], true)
    ) {
      return false;
    }
    if (!matchesAnyStatus(job.payment_status, filters.paymentStatuses ?? [])) {
      return false;
    }
    if (selectedClients.size > 0) {
      const key = clientIdentityKey(job.client_name);
      if (!key || !selectedClients.has(key)) return false;
    }
    if (selectedYears.size > 0) {
      const poYear = yearFromPoDate(job.po_date);
      if (poYear == null || !selectedYears.has(poYear)) return false;
    }
    if (query) {
      const hay = [
        job.po_number,
        job.project_title,
        job.client_name,
        job.location,
        job.invoice_numbers,
        job.general_remarks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

export function poDateSortKey(poDate: string | null | undefined): number {
  if (!poDate) return 0;
  const t = Date.parse(poDate);
  return Number.isFinite(t) ? t : 0;
}

export function sortJobsNewestFirst(jobs: PoMasterlistJob[]): PoMasterlistJob[] {
  return [...jobs].sort((a, b) => {
    const byDate = poDateSortKey(b.po_date) - poDateSortKey(a.po_date);
    if (byDate !== 0) return byDate;
    return (b.sheet_row ?? 0) - (a.sheet_row ?? 0);
  });
}
