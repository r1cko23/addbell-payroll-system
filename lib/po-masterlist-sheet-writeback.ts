/**
 * Async one-way Google Sheets writeback for po_masterlist_jobs.
 *
 * Contract:
 * - Postgres commit is source of truth and always wins.
 * - Callers must NOT await the Google round-trip on the user request path.
 * - schedulePoMasterlistSheetWriteback enqueues then kicks a best-effort flush.
 * - Failed Google writes leave the app row intact and retry via the queue.
 */

import { getAdminClient } from "@/lib/fund-request-api";
import {
  isPoMasterlistSheetWritebackConfigured,
  updatePoMasterlistSheetRow,
} from "@/lib/google-sheets-po-masterlist";
import {
  buildPoMasterlistSheetRowValues,
  canMirrorPoMasterlistJob,
} from "@/lib/po-masterlist-sheet-row";
import {
  recordPoMasterlistSheetWritebackEnqueued,
  recordPoMasterlistSheetWritebackFailure,
  recordPoMasterlistSheetWritebackSuccess,
} from "@/lib/platform-runtime-metrics";
import type { PoMasterlistJob } from "@/types/po-masterlist";

const DEFAULT_FLUSH_LIMIT = 20;
const MAX_ATTEMPTS = 5;

type AdminClient = ReturnType<typeof getAdminClient>;

type QueueRow = {
  id: string;
  job_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

function asJob(row: Record<string, unknown>): PoMasterlistJob {
  return row as unknown as PoMasterlistJob;
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
  limit: number
): Promise<QueueRow[]> {
  const { data, error } = await admin
    .from("po_masterlist_sheet_writeback_queue")
    .select("id, job_id, status, attempts, last_error")
    .in("status", ["pending", "failed"])
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
      attempts: item.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function mirrorJobRow(
  admin: AdminClient,
  job: PoMasterlistJob
): Promise<void> {
  if (!canMirrorPoMasterlistJob(job)) {
    throw new Error(
      "Job is missing sheet_tab/sheet_row; cannot mirror without a linked sheet coordinate."
    );
  }

  const values = buildPoMasterlistSheetRowValues(job);
  await updatePoMasterlistSheetRow({
    sheetTab: job.sheet_tab,
    sheetRow: job.sheet_row,
    values,
  });

  const syncedAt = new Date().toISOString();
  const { error } = await admin
    .from("po_masterlist_jobs")
    .update({
      sheet_synced_at: syncedAt,
      sheet_sync_error: null,
      updated_at: syncedAt,
    })
    .eq("id", job.id);

  if (error) throw new Error(error.message);
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
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      configured: false,
    };
  }

  const claimed = await claimQueueItems(admin, limit);
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of claimed) {
    const took = await markQueueProcessing(admin, item);
    if (!took) {
      skipped += 1;
      continue;
    }

    try {
      const { data: jobRow, error: jobError } = await admin
        .from("po_masterlist_jobs")
        .select("*")
        .eq("id", item.job_id)
        .maybeSingle();

      if (jobError) throw new Error(jobError.message);
      if (!jobRow) throw new Error(`Job ${item.job_id} not found`);

      await mirrorJobRow(admin, asJob(jobRow as Record<string, unknown>));

      const { error: doneError } = await admin
        .from("po_masterlist_sheet_writeback_queue")
        .update({
          status: "done",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (doneError) throw new Error(doneError.message);
      recordPoMasterlistSheetWritebackSuccess();
      succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Writeback failed";
      const attempts = item.attempts + 1;

      await admin
        .from("po_masterlist_sheet_writeback_queue")
        .update({
          status: "failed",
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await admin
        .from("po_masterlist_jobs")
        .update({
          sheet_sync_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.job_id);

      recordPoMasterlistSheetWritebackFailure();
      failed += 1;
      console.error(
        "[po-masterlist-sheet-writeback] item failed",
        item.id,
        `attempt ${attempts}/${MAX_ATTEMPTS}`,
        message
      );
    }
  }

  return {
    processed: claimed.length,
    succeeded,
    failed,
    skipped,
    configured: true,
  };
}
