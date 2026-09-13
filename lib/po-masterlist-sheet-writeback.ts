/**
 * Async one-way Google Sheets writeback for po_masterlist_jobs.
 *
 * Contract:
 * - Google Sheet is the source of truth on pull.
 * - App saves still enqueue an async sheet write so webapp entries reach the sheet.
 * - Callers must NOT await the Google round-trip on the user request path.
 * - A diverged sheet row cancels pending writeback so the app cannot overwrite it.
 * - Sheets write-quota errors abort the flush, keep items retryable, and cool down
 *   for the per-minute quota window instead of hammering remaining rows.
 */

import { getAdminClient } from "@/lib/fund-request-api";
import {
  isPoMasterlistSheetWritebackConfigured,
  updatePoMasterlistSheetRows,
} from "@/lib/google-sheets-po-masterlist";
import {
  buildPoMasterlistSheetRowValues,
  canMirrorPoMasterlistJob,
  poMasterlistSheetRowFingerprint,
} from "@/lib/po-masterlist-sheet-row";
import {
  recordPoMasterlistSheetWritebackEnqueued,
  recordPoMasterlistSheetWritebackFailure,
  recordPoMasterlistSheetWritebackSuccess,
} from "@/lib/platform-runtime-metrics";
import type { PoMasterlistJob } from "@/types/po-masterlist";

const DEFAULT_FLUSH_LIMIT = 50;
const MAX_ATTEMPTS = 5;
const WRITE_QUOTA_COOLDOWN_MS = 60_000;

let quotaCooldownUntilMs = 0;
let flushInFlight = false;
let flushQueued = false;

type AdminClient = ReturnType<typeof getAdminClient>;

type QueueRow = {
  id: string;
  job_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

type ClaimedWrite = {
  item: QueueRow;
  originalAttempts: number;
  job: PoMasterlistJob;
};

function asJob(row: Record<string, unknown>): PoMasterlistJob {
  return row as unknown as PoMasterlistJob;
}

function emptyFlushResult(
  configured: boolean
): FlushPoMasterlistSheetWritebackResult {
  return {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    configured,
  };
}

export function isPoMasterlistSheetWriteQuotaError(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error ?? "")
  ).toLowerCase();
  if (!message.trim()) return false;

  const status =
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : null;
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : null;

  return (
    status === 429 ||
    code === 429 ||
    code === "429" ||
    message.includes("quota exceeded") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    /\b429\b/.test(message)
  );
}

export function resetPoMasterlistSheetWritebackRuntimeState(): void {
  quotaCooldownUntilMs = 0;
  flushInFlight = false;
  flushQueued = false;
}

/**
 * Insert a pending queue row for a job. Does not call Google.
 * Dedupes against an existing pending/processing/failed item for the same job.
 */
export async function enqueuePoMasterlistSheetWriteback(
  jobId: string,
  admin: AdminClient = getAdminClient()
): Promise<{ queueId: string; created: boolean }> {
  const { data: existing, error: existingError } = await admin
    .from("po_masterlist_sheet_writeback_queue")
    .select("id, status")
    .eq("job_id", jobId)
    .in("status", ["pending", "processing", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    if (existing.status === "failed") {
      const { error: resetError } = await admin
        .from("po_masterlist_sheet_writeback_queue")
        .update({
          status: "pending",
          attempts: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (resetError) throw new Error(resetError.message);
    }
    return { queueId: existing.id as string, created: false };
  }

  const { data: inserted, error: insertError } = await admin
    .from("po_masterlist_sheet_writeback_queue")
    .insert({
      job_id: jobId,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message ?? "Failed to enqueue sheet writeback");
  }

  recordPoMasterlistSheetWritebackEnqueued();
  return { queueId: inserted.id as string, created: true };
}

/**
 * Drop pending/failed/processing writeback items so a newer sheet row is not
 * overwritten by a stale app flush.
 */
export async function cancelPoMasterlistSheetWriteback(
  jobId: string,
  admin: AdminClient = getAdminClient()
): Promise<void> {
  const { error } = await admin
    .from("po_masterlist_sheet_writeback_queue")
    .delete()
    .eq("job_id", jobId)
    .in("status", ["pending", "processing", "failed"]);
  if (error) throw new Error(error.message);
}

/**
 * Enqueue writeback and kick a background flush without blocking the caller.
 * Safe to call after a successful Postgres save.
 */
export function schedulePoMasterlistSheetWriteback(jobId: string): void {
  void (async () => {
    try {
      await enqueuePoMasterlistSheetWriteback(jobId);
      await flushPoMasterlistSheetWritebackQueue();
    } catch (err) {
      console.error(
        "[po-masterlist-sheet-writeback] schedule failed",
        jobId,
        err instanceof Error ? err.message : err
      );
    }
  })();
}

export type FlushPoMasterlistSheetWritebackResult = {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  configured: boolean;
};

async function claimQueueItems(
  admin: AdminClient,
  limit: number,
  statuses: Array<"pending" | "failed">
): Promise<QueueRow[]> {
  const { data, error } = await admin
    .from("po_masterlist_sheet_writeback_queue")
    .select("id, job_id, status, attempts, last_error")
    .in("status", statuses)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as QueueRow[];
}

async function markQueueProcessing(
  admin: AdminClient,
  item: QueueRow
): Promise<boolean> {
  const { data, error } = await admin
    .from("po_masterlist_sheet_writeback_queue")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function markQueueDone(admin: AdminClient, item: QueueRow): Promise<void> {
  const { error } = await admin
    .from("po_masterlist_sheet_writeback_queue")
    .update({
      status: "done",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  if (error) throw new Error(error.message);
}

async function markJobSynced(
  admin: AdminClient,
  jobId: string,
  fingerprint: string
): Promise<void> {
  const syncedAt = new Date().toISOString();
  const { error } = await admin
    .from("po_masterlist_jobs")
    .update({
      sheet_synced_at: syncedAt,
      sheet_sync_error: null,
      sheet_sync_fingerprint: fingerprint,
      updated_at: syncedAt,
    })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

async function markItemHardFailed(
  admin: AdminClient,
  item: QueueRow,
  originalAttempts: number,
  message: string
): Promise<void> {
  const attempts = originalAttempts + 1;
  await admin
    .from("po_masterlist_sheet_writeback_queue")
    .update({
      status: "failed",
      attempts,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  await admin
    .from("po_masterlist_jobs")
    .update({
      sheet_sync_error: message,
    })
    .eq("id", item.job_id);

  recordPoMasterlistSheetWritebackFailure();
  console.error(
    "[po-masterlist-sheet-writeback] item failed",
    item.id,
    `attempt ${attempts}/${MAX_ATTEMPTS}`,
    message
  );
}

async function releaseQuotaItems(
  admin: AdminClient,
  writes: ClaimedWrite[],
  message: string
): Promise<void> {
  quotaCooldownUntilMs = Date.now() + WRITE_QUOTA_COOLDOWN_MS;
  const now = new Date().toISOString();

  for (const write of writes) {
    await admin
      .from("po_masterlist_sheet_writeback_queue")
      .update({
        status: "pending",
        attempts: write.originalAttempts,
        last_error: message,
        updated_at: now,
      })
      .eq("id", write.item.id);

    await admin
      .from("po_masterlist_jobs")
      .update({
        sheet_sync_error: message,
      })
      .eq("id", write.item.job_id);

    recordPoMasterlistSheetWritebackFailure();
    console.error(
      "[po-masterlist-sheet-writeback] write quota exceeded; pausing flush",
      write.item.id,
      message
    );
  }
}

async function loadMirrorableJob(
  admin: AdminClient,
  item: QueueRow,
  originalAttempts: number
): Promise<PoMasterlistJob | null> {
  const { data: jobRow, error: jobError } = await admin
    .from("po_masterlist_jobs")
    .select("*")
    .eq("id", item.job_id)
    .maybeSingle();

  if (jobError) {
    await markItemHardFailed(admin, item, originalAttempts, jobError.message);
    return null;
  }
  if (!jobRow) {
    await markItemHardFailed(
      admin,
      item,
      originalAttempts,
      `Job ${item.job_id} not found`
    );
    return null;
  }

  const job = asJob(jobRow as Record<string, unknown>);
  if (!canMirrorPoMasterlistJob(job)) {
    await markItemHardFailed(
      admin,
      item,
      originalAttempts,
      "Job is missing sheet_tab/sheet_row; cannot mirror without a linked sheet coordinate."
    );
    return null;
  }

  return job;
}

async function processClaimedBatch(
  admin: AdminClient,
  claimed: QueueRow[]
): Promise<{
  succeeded: number;
  failed: number;
  skipped: number;
  hitQuota: boolean;
}> {
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const writes: ClaimedWrite[] = [];

  for (const item of claimed) {
    const originalAttempts = item.attempts;
    const took = await markQueueProcessing(admin, item);
    if (!took) {
      skipped += 1;
      continue;
    }

    const job = await loadMirrorableJob(admin, item, originalAttempts);
    if (!job) {
      failed += 1;
      continue;
    }

    writes.push({ item, originalAttempts, job });
  }

  if (writes.length === 0) {
    return { succeeded, failed, skipped, hitQuota: false };
  }

  try {
    await updatePoMasterlistSheetRows(
      writes.map(({ job }) => ({
        sheetTab: job.sheet_tab as string,
        sheetRow: job.sheet_row as number,
        values: buildPoMasterlistSheetRowValues(job),
      }))
    );

    for (const write of writes) {
      await markJobSynced(
        admin,
        write.job.id,
        poMasterlistSheetRowFingerprint(write.job)
      );
      await markQueueDone(admin, write.item);
      recordPoMasterlistSheetWritebackSuccess();
      succeeded += 1;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Writeback failed";
    if (isPoMasterlistSheetWriteQuotaError(err)) {
      await releaseQuotaItems(admin, writes, message);
      failed += writes.length;
      return { succeeded, failed, skipped, hitQuota: true };
    }

    for (const write of writes) {
      await markItemHardFailed(
        admin,
        write.item,
        write.originalAttempts,
        message
      );
      failed += 1;
    }
  }

  return { succeeded, failed, skipped, hitQuota: false };
}

/**
 * Process pending/failed queue items. Does not throw for individual Google failures.
 */
export async function flushPoMasterlistSheetWritebackQueue(
  options: { limit?: number; admin?: AdminClient } = {}
): Promise<FlushPoMasterlistSheetWritebackResult> {
  const admin = options.admin ?? getAdminClient();
  const limit = options.limit ?? DEFAULT_FLUSH_LIMIT;

  if (!isPoMasterlistSheetWritebackConfigured()) {
    return emptyFlushResult(false);
  }

  if (Date.now() < quotaCooldownUntilMs) {
    return emptyFlushResult(true);
  }

  if (flushInFlight) {
    flushQueued = true;
    return emptyFlushResult(true);
  }

  flushInFlight = true;
  const totals = emptyFlushResult(true);
  let includeFailedRetries = true;

  try {
    while (true) {
      flushQueued = false;
      if (Date.now() < quotaCooldownUntilMs) break;

      const claimed = await claimQueueItems(
        admin,
        limit,
        includeFailedRetries ? ["pending", "failed"] : ["pending"]
      );
      includeFailedRetries = false;
      if (claimed.length === 0) {
        if (flushQueued) continue;
        break;
      }

      totals.processed += claimed.length;
      const batch = await processClaimedBatch(admin, claimed);
      totals.succeeded += batch.succeeded;
      totals.failed += batch.failed;
      totals.skipped += batch.skipped;
      if (batch.hitQuota) break;
    }
  } finally {
    flushInFlight = false;
  }

  return totals;
}
