import {
  isClientPoPlaceholder,
  normalizeProjectTitleKey,
} from "@/lib/fund-request-client-po-masterlist";
import { parseFundRequestProjectDetails } from "@/lib/fund-request-project-details";
import type { FundRequestRow } from "@/types/fund-request";

export type MasterlistPoSuggestHints = {
  title?: string | null;
  location?: string | null;
  poAmount?: number | null;
};

export type MasterlistPoSuggestJob = {
  id?: string | null;
  po_number: string;
  project_title?: string | null;
  location?: string | null;
  po_amount?: number | null;
  client_name?: string | null;
};

export type RankedMasterlistPoSuggestion = MasterlistPoSuggestJob & {
  score: number;
  reasons: string[];
};

function normalizeLooseKey(raw: string | null | undefined): string {
  return (raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function amountClose(
  left: number | null | undefined,
  right: number | null | undefined
): boolean {
  if (left == null || right == null) return false;
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const a = Math.abs(left);
  const b = Math.abs(right);
  if (a === 0 && b === 0) return true;
  const diff = Math.abs(a - b);
  if (diff <= 1) return true;
  return diff / Math.max(a, b) <= 0.02;
}

/**
 * Rank Projects masterlist jobs against fund-request title / location / amount
 * so NTP / PO-to-follow updates can pick the live client P.O.
 */
export function rankMasterlistJobsForFundRequestHints(
  jobs: readonly MasterlistPoSuggestJob[],
  hints: MasterlistPoSuggestHints | null | undefined,
  options?: { limit?: number }
): RankedMasterlistPoSuggestion[] {
  const titleKey = normalizeProjectTitleKey(hints?.title);
  const locationKey = normalizeLooseKey(hints?.location);
  const amount = hints?.poAmount ?? null;
  if (!titleKey && !locationKey && amount == null) return [];

  const ranked: RankedMasterlistPoSuggestion[] = [];
  for (const job of jobs) {
    if (!job.po_number?.trim() || isClientPoPlaceholder(job.po_number)) continue;

    const jobTitleKey = normalizeProjectTitleKey(job.project_title);
    const jobLocationKey = normalizeLooseKey(job.location);
    let score = 0;
    const reasons: string[] = [];

    if (titleKey && jobTitleKey) {
      if (titleKey === jobTitleKey) {
        score += 100;
        reasons.push("exact title");
      } else if (
        titleKey.length >= 8 &&
        jobTitleKey.length >= 8 &&
        (titleKey.includes(jobTitleKey) || jobTitleKey.includes(titleKey))
      ) {
        score += 70;
        reasons.push("similar title");
      } else {
        // Token overlap for typos / word order (SIGNAGE vs SUGNAGE still may miss)
        const titleTokens = (hints?.title || "")
          .toUpperCase()
          .split(/[^A-Z0-9]+/)
          .filter((t) => t.length >= 4);
        const jobTokens = new Set(
          (job.project_title || "")
            .toUpperCase()
            .split(/[^A-Z0-9]+/)
            .filter((t) => t.length >= 4)
        );
        let overlap = 0;
        for (const token of titleTokens) {
          if (jobTokens.has(token)) overlap += 1;
        }
        if (overlap > 0) {
          score += Math.min(50, overlap * 18);
          reasons.push("shared title words");
        }
      }
    }

    if (locationKey && jobLocationKey) {
      if (locationKey === jobLocationKey) {
        score += 40;
        reasons.push("exact location");
      } else if (
        locationKey.length >= 5 &&
        jobLocationKey.length >= 5 &&
        (locationKey.includes(jobLocationKey) ||
          jobLocationKey.includes(locationKey))
      ) {
        score += 25;
        reasons.push("similar location");
      }
    }

    if (amountClose(amount, job.po_amount)) {
      score += 35;
      reasons.push("matching amount");
    }

    if (score <= 0) continue;
    ranked.push({ ...job, score, reasons });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.po_number.localeCompare(b.po_number);
  });

  const limit = options?.limit ?? 8;
  return ranked.slice(0, limit);
}

export function fundRequestMasterlistSuggestHints(
  request: Pick<
    FundRequestRow,
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_number"
    | "po_amount"
  >
): MasterlistPoSuggestHints {
  const projects = parseFundRequestProjectDetails(request);
  const primary = projects[0];
  return {
    title: primary?.title || request.project_title || null,
    location: primary?.location || request.project_location || null,
    poAmount:
      primary?.po_amount != null
        ? Number(primary.po_amount)
        : request.po_amount != null
          ? Number(request.po_amount)
          : null,
  };
}
