import {
  getBillingInvoiceLookupCacheStats,
} from "@/lib/billing-invoice-lookup-cache";
import { isGoogleSheetsBillingConfigured } from "@/lib/google-sheets-billing-invoice";
import { getPlatformRuntimeMetrics } from "@/lib/platform-runtime-metrics";
import { formatStorageBytes } from "@/lib/platform-storage-monitor";

export const GOOGLE_SHEETS_FREE_TIER_LIMITS = {
  readRequestsPerMinute: 300,
  readRequestsPerMinutePerUser: 60,
} as const;

export const VERCEL_HOBBY_LIMITS = {
  bandwidthBytes: 100 * 1024 * 1024 * 1024,
  serverlessExecutionHours: 100,
  serverlessMaxDurationSeconds: 10,
  maxRequestBodyBytes: 4.5 * 1024 * 1024,
  cronJobs: 2,
} as const;

export type GooglePlatformMonitorSnapshot = {
  configured: boolean;
  spreadsheetIdMasked: string | null;
  serviceAccountEmail: string | null;
  limits: typeof GOOGLE_SHEETS_FREE_TIER_LIMITS;
  cache: ReturnType<typeof getBillingInvoiceLookupCacheStats>;
  runtime: ReturnType<typeof getPlatformRuntimeMetrics>;
  estimatedApiCallsSaved: number;
  notes: string[];
};

export type VercelPlatformMonitorSnapshot = {
  runningOnVercel: boolean;
  environment: string | null;
  region: string | null;
  projectId: string | null;
  limits: typeof VERCEL_HOBBY_LIMITS;
  runtime: ReturnType<typeof getPlatformRuntimeMetrics>;
  estimatedBandwidthSavedBytes: number;
  dashboardUrl: string;
  notes: string[];
};

function maskSpreadsheetId(id: string): string {
  if (id.length <= 8) return "****";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function getGooglePlatformMonitorSnapshot(): GooglePlatformMonitorSnapshot {
  const configured = isGoogleSheetsBillingConfigured();
  const spreadsheetId = process.env.GOOGLE_SHEETS_BILLING_SPREADSHEET_ID?.trim() ?? null;
  const runtime = getPlatformRuntimeMetrics();
  const cache = getBillingInvoiceLookupCacheStats();

  const estimatedApiCallsSaved =
    runtime.billingPoCacheHits +
    runtime.billingSheetListCacheHits +
    runtime.billingPoCacheHits * 2;

  const notes: string[] = [
    "Counters reset when the server redeploys or cold-starts (Vercel serverless).",
    `Google Cloud free quota: ~${GOOGLE_SHEETS_FREE_TIER_LIMITS.readRequestsPerMinute} read requests/min per project.`,
    "Each uncached P.O. lookup uses 1 metadata call plus 1–2 batch reads across invoice tabs.",
  ];

  if (!configured) {
    notes.unshift("Google Sheets billing lookup is not configured in environment variables.");
  } else if (cache.poCacheEntries > 0) {
    notes.unshift(
      `${cache.poCacheEntries} P.O. result(s) cached for up to ${cache.poCacheTtlMinutes} minutes.`
    );
  }

  const hitRate =
    runtime.billingPoCacheHits + runtime.billingPoCacheMisses > 0
      ? (runtime.billingPoCacheHits /
          (runtime.billingPoCacheHits + runtime.billingPoCacheMisses)) *
        100
      : 0;

  if (hitRate > 0) {
    notes.unshift(`Billing lookup cache hit rate this instance: ${hitRate.toFixed(0)}%.`);
  }

  return {
    configured,
    spreadsheetIdMasked: spreadsheetId ? maskSpreadsheetId(spreadsheetId) : null,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? null,
    limits: GOOGLE_SHEETS_FREE_TIER_LIMITS,
    cache,
    runtime,
    estimatedApiCallsSaved,
    notes,
  };
}

export function getVercelPlatformMonitorSnapshot(): VercelPlatformMonitorSnapshot {
  const runtime = getPlatformRuntimeMetrics();
  const runningOnVercel = process.env.VERCEL === "1";
  const projectId = process.env.VERCEL_PROJECT_ID?.trim() ?? null;

  const dashboardUrl = projectId
    ? `https://vercel.com/dashboard/${projectId}/usage`
    : "https://vercel.com/dashboard/usage";

  const notes: string[] = [
    "Vercel Hobby bandwidth (100 GB/month) is only visible in the Vercel dashboard — there is no stable public API on the free plan.",
    `Fund request files upload directly to Supabase, saving an estimated ${formatStorageBytes(runtime.fundRequestDirectUploadBytes)} through Vercel this instance.`,
    `API request bodies are capped at ${formatStorageBytes(VERCEL_HOBBY_LIMITS.maxRequestBodyBytes)} on Hobby — large files must use direct Storage upload.`,
  ];

  if (!runningOnVercel) {
    notes.unshift("Running locally — Vercel limits apply after deployment.");
  }

  return {
    runningOnVercel,
    environment: process.env.VERCEL_ENV?.trim() ?? null,
    region: process.env.VERCEL_REGION?.trim() ?? null,
    projectId,
    limits: VERCEL_HOBBY_LIMITS,
    runtime,
    estimatedBandwidthSavedBytes: runtime.fundRequestDirectUploadBytes,
    dashboardUrl,
    notes,
  };
}

export function getPlatformApiMonitorSnapshot(): {
  google: GooglePlatformMonitorSnapshot;
  vercel: VercelPlatformMonitorSnapshot;
} {
  return {
    google: getGooglePlatformMonitorSnapshot(),
    vercel: getVercelPlatformMonitorSnapshot(),
  };
}
