/**
 * Persist a P.O. masterlist job in Postgres (source of truth), then schedule
 * a non-blocking one-way Google Sheets mirror. Never awaits the Sheets API.
 */

import { getAdminClient } from "@/lib/fund-request-api";
import { schedulePoMasterlistSheetWriteback } from "@/lib/po-masterlist-sheet-writeback";
import type { PoMasterlistJob } from "@/types/po-masterlist";

type AdminClient = ReturnType<typeof getAdminClient>;

export type PoMasterlistJobWritable = Omit<
  PoMasterlistJob,
  "id" | "created_at" | "updated_at" | "sheet_synced_at" | "sheet_sync_error"
> & {
  id?: string;
};

function stripUndefined<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
  }
  return next;
}

/**
 * Insert or update a masterlist job, then fire-and-forget sheet writeback.
 * Returns as soon as Postgres commits.
 */
export async function savePoMasterlistJobAndScheduleSheetWriteback(
  input: PoMasterlistJobWritable,
  admin: AdminClient = getAdminClient()
): Promise<PoMasterlistJob> {
  const now = new Date().toISOString();
  const payload = stripUndefined({
    ...input,
    updated_at: now,
  } as Record<string, unknown>);

  let job: PoMasterlistJob;

  if (input.id) {
    const { id: _id, ...updateFields } = payload as PoMasterlistJobWritable & {
      id?: string;
      updated_at: string;
    };
    void _id;
    const { data, error } = await admin
      .from("po_masterlist_jobs")
      .update(updateFields)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update po_masterlist_jobs row");
    }
    job = data as unknown as PoMasterlistJob;
  } else {
    const { data, error } = await admin
      .from("po_masterlist_jobs")
      .insert({ ...payload, created_at: now })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to insert po_masterlist_jobs row");
    }
    job = data as unknown as PoMasterlistJob;
  }

  // App save is done. Mirror is best-effort and must not delay the caller.
  schedulePoMasterlistSheetWriteback(job.id);
  return job;
}
