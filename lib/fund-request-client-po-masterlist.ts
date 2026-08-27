import {
  isStrongPoNumberKey,
  normalizePoNumberKey,
} from "@/lib/purchase-order-masterlist-link";
import {
  parseFundRequestProjectDetails,
  type FundRequestProjectDetail,
} from "@/lib/fund-request-project-details";
import {
  isOfficeRelatedFundRequest,
  type FundRequestRow,
} from "@/types/fund-request";

/** Placeholders used until the client PO is live on Operations → Projects. */
export const CLIENT_PO_PLACEHOLDER_PATTERNS = [
  "NTP",
  "NO PO, WITH NTP",
  "WITH NTP ONLY",
  "PO TO FOLLOW",
  "P.O. TO FOLLOW",
  "P.O. FOR APPROVAL",
  "PO FOR APPROVAL",
  "TO FOLLOW",
  "TBA",
  "TBD",
  "N/A",
  "NA",
  "NONE",
] as const;

export type FundRequestClientPoFields = Pick<
  FundRequestRow,
  "po_number" | "project_details" | "status" | "rejected_at" | "reference_mode"
> & {
  project_title?: string | null;
};

export type FundRequestClientPoMasterlistStatus = {
  /** Not rejected and client PO is placeholder, blank, or not on masterlist. */
  needsUpdate: boolean;
  /** Placeholder/blank and a unique Projects masterlist title match exists. */
  readyOnMasterlist: boolean;
  reason:
    | "ok"
    | "rejected"
    | "office_related"
    | "placeholder"
    | "missing"
    | "unmatched";
};

function compactUpper(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeClientPoPlaceholderKey(raw: string | null | undefined): string {
  return compactUpper(raw || "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isClientPoPlaceholder(raw: string | null | undefined): boolean {
  const key = normalizeClientPoPlaceholderKey(raw);
  if (!key) return true;
  if ((CLIENT_PO_PLACEHOLDER_PATTERNS as readonly string[]).includes(key)) {
    return true;
  }
  // Loose: "… NTP …" / "PO to follow …"
  if (/\bNTP\b/.test(key)) return true;
  if (key.includes("TO FOLLOW")) return true;
  if (key.includes("FOR APPROVAL") && key.includes("PO")) return true;
  return false;
}

export function normalizeProjectTitleKey(raw: string | null | undefined): string {
  return (raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function collectFundRequestClientPoNumbers(
  request: Pick<FundRequestRow, "po_number" | "project_details"> & {
    project_title?: string | null;
    project_location?: string | null;
    current_project_percentage?: number | null;
    po_amount?: number | null;
  }
): string[] {
  const values: string[] = [];
  const top = (request.po_number || "").trim();
  if (top) values.push(top);

  const projects = parseFundRequestProjectDetails({
    project_details: request.project_details,
    po_number: request.po_number,
    project_title: request.project_title ?? null,
    project_location: request.project_location ?? null,
    current_project_percentage: request.current_project_percentage ?? null,
    po_amount: request.po_amount ?? null,
  });
  for (const project of projects) {
    const po = (project.po_number || "").trim();
    if (po) values.push(po);
  }
  return values;
}

export function primaryFundRequestClientPoNumber(
  request: Pick<FundRequestRow, "po_number" | "project_details">
): string {
  const values = collectFundRequestClientPoNumbers(request);
  return values[0] ?? "";
}

export function collectFundRequestProjectTitles(
  request: Pick<FundRequestRow, "project_details" | "po_number"> & {
    project_title?: string | null;
    project_location?: string | null;
    current_project_percentage?: number | null;
    po_amount?: number | null;
  }
): string[] {
  const titles: string[] = [];
  const top = (request.project_title || "").trim();
  if (top) titles.push(top);

  const projects = parseFundRequestProjectDetails({
    project_details: request.project_details,
    po_number: request.po_number,
    project_title: request.project_title ?? null,
    project_location: request.project_location ?? null,
    current_project_percentage: request.current_project_percentage ?? null,
    po_amount: request.po_amount ?? null,
  });
  for (const project of projects as FundRequestProjectDetail[]) {
    const title = (project.title || "").trim();
    if (title) titles.push(title);
  }
  return titles;
}

export function buildMasterlistPoKeySet(
  poNumbers: Array<string | null | undefined>
): Set<string> {
  const keys = new Set<string>();
  for (const po of poNumbers) {
    const key = normalizePoNumberKey(po);
    if (isStrongPoNumberKey(key)) keys.add(key);
  }
  return keys;
}

/**
 * Title → job count map for unique title matching (ready-on-masterlist).
 * Only titles that appear exactly once are actionable.
 */
export function buildUniqueMasterlistTitleKeySet(
  titles: Array<string | null | undefined>
): Set<string> {
  const counts = new Map<string, number>();
  for (const title of titles) {
    const key = normalizeProjectTitleKey(title);
    if (!key || key.length < 8) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const unique = new Set<string>();
  for (const [key, count] of counts) {
    if (count === 1) unique.add(key);
  }
  return unique;
}

export type EvaluateFundRequestClientPoOptions = {
  /**
   * When false (masterlist lookup still loading), do not flag strong POs as
   * unmatched — empty keys would otherwise false-positive every real PO.
   * Placeholders / missing still flag.
   */
  masterlistLoaded?: boolean;
};

export function evaluateFundRequestClientPoMasterlist(
  request: FundRequestClientPoFields,
  masterlistPoKeys: Set<string>,
  uniqueMasterlistTitleKeys?: Set<string>,
  options?: EvaluateFundRequestClientPoOptions
): FundRequestClientPoMasterlistStatus {
  const masterlistLoaded = options?.masterlistLoaded !== false;

  if (request.status === "rejected") {
    return { needsUpdate: false, readyOnMasterlist: false, reason: "rejected" };
  }

  // Office / internal stock — no client project or Projects masterlist P.O.
  if (isOfficeRelatedFundRequest(request.reference_mode)) {
    return {
      needsUpdate: false,
      readyOnMasterlist: false,
      reason: "office_related",
    };
  }

  const poValues = collectFundRequestClientPoNumbers(request);
  if (poValues.length === 0) {
    const ready = hasUniqueTitleOnMasterlist(request, uniqueMasterlistTitleKeys);
    return {
      needsUpdate: true,
      readyOnMasterlist: ready,
      reason: "missing",
    };
  }

  let anyPlaceholder = false;
  let anyUnmatchedStrong = false;
  let anyMatchedStrong = false;

  for (const po of poValues) {
    if (isClientPoPlaceholder(po)) {
      anyPlaceholder = true;
      continue;
    }
    const key = normalizePoNumberKey(po);
    if (!isStrongPoNumberKey(key)) {
      // Weak non-placeholder (e.g. "250") — treat as needing confirmation on masterlist
      anyUnmatchedStrong = true;
      continue;
    }
    if (masterlistPoKeys.has(key)) {
      anyMatchedStrong = true;
    } else {
      anyUnmatchedStrong = true;
    }
  }

  if (anyPlaceholder) {
    const ready = hasUniqueTitleOnMasterlist(request, uniqueMasterlistTitleKeys);
    return {
      needsUpdate: true,
      readyOnMasterlist: ready,
      reason: "placeholder",
    };
  }

  // Avoid false "Needs client P.O. update" while Projects lookup is in flight.
  if (!masterlistLoaded) {
    return { needsUpdate: false, readyOnMasterlist: false, reason: "ok" };
  }

  if (anyUnmatchedStrong && !anyMatchedStrong) {
    return {
      needsUpdate: true,
      readyOnMasterlist: false,
      reason: "unmatched",
    };
  }

  // Mixed: some matched, some unmatched — still flag so they can correct remaining rows
  if (anyUnmatchedStrong) {
    return {
      needsUpdate: true,
      readyOnMasterlist: false,
      reason: "unmatched",
    };
  }

  return { needsUpdate: false, readyOnMasterlist: false, reason: "ok" };
}

export type MasterlistBudgetContext = {
  jobId: string;
  poNumber: string;
  title: string;
  location: string | null;
  poAmount: number | null;
};

/** Match a fund request’s client PO to a Projects masterlist job (SoT). */
export function matchMasterlistJobForFundRequestPo(
  request: Pick<FundRequestRow, "po_number" | "project_details">,
  jobs: Array<{
    id: string;
    po_number: string | null;
    project_title: string | null;
    location: string | null;
    po_amount: number | null;
  }>
): MasterlistBudgetContext | null {
  const poValues = collectFundRequestClientPoNumbers(request);
  for (const po of poValues) {
    if (isClientPoPlaceholder(po)) continue;
    const key = normalizePoNumberKey(po);
    if (!isStrongPoNumberKey(key)) continue;
    const match = jobs.find(
      (job) => normalizePoNumberKey(job.po_number) === key
    );
    if (match) {
      return {
        jobId: match.id,
        poNumber: match.po_number?.trim() || po,
        title: match.project_title?.trim() || "Untitled job",
        location: match.location,
        poAmount: match.po_amount,
      };
    }
  }
  return null;
}

function hasUniqueTitleOnMasterlist(
  request: FundRequestClientPoFields,
  uniqueMasterlistTitleKeys?: Set<string>
): boolean {
  if (!uniqueMasterlistTitleKeys || uniqueMasterlistTitleKeys.size === 0) {
    return false;
  }
  for (const title of collectFundRequestProjectTitles(request)) {
    const key = normalizeProjectTitleKey(title);
    if (key && uniqueMasterlistTitleKeys.has(key)) return true;
  }
  return false;
}
