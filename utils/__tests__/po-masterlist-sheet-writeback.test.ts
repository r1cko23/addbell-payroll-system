import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const QUOTA_ERROR_MESSAGE =
  "Quota exceeded for quota metric 'Write requests' and limit 'Write requests per minute per user' of service 'sheets.googleapis.com' for consumer 'project_number:66190440682'.";

const { updateSheetRowMock, updateSheetRowsMock } = vi.hoisted(() => ({
  updateSheetRowMock: vi.fn(),
  updateSheetRowsMock: vi.fn(),
}));

vi.mock("@/lib/google-sheets-po-masterlist", () => ({
  isPoMasterlistSheetWritebackConfigured: () => true,
  updatePoMasterlistSheetRow: (...args: unknown[]) => updateSheetRowMock(...args),
  updatePoMasterlistSheetRows: (...args: unknown[]) =>
    updateSheetRowsMock(...args),
}));

import {
  enqueuePoMasterlistSheetWriteback,
  flushPoMasterlistSheetWritebackQueue,
  isPoMasterlistSheetWriteQuotaError,
  resetPoMasterlistSheetWritebackRuntimeState,
} from "@/lib/po-masterlist-sheet-writeback";

type QueueRow = {
  id: string;
  job_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

type JobRow = {
  id: string;
  po_number: string;
  po_date: string | null;
  po_received_date: string | null;
  po_amount: number | null;
  project_title: string | null;
  client_name: string | null;
  location: string | null;
  payment_terms: string | null;
  cari: string | null;
  cari_expiry: string | null;
  project_status: string | null;
  payment_status: string | null;
  invoice_numbers: string | null;
  general_remarks: string | null;
  sheet_tab: string | null;
  sheet_row: number | null;
  sheet_synced_at: string | null;
  sheet_sync_error: string | null;
  updated_at: string;
};

function googleWriteCount() {
  return updateSheetRowMock.mock.calls.length + updateSheetRowsMock.mock.calls.length;
}

function makeJob(id: string, row: number): JobRow {
  return {
    id,
    po_number: `PO-${row}`,
    po_date: "2026-01-15",
    po_received_date: null,
    po_amount: 1000,
    project_title: "Civil works",
    client_name: "Acme",
    location: null,
    payment_terms: null,
    cari: null,
    cari_expiry: null,
    project_status: "ONGOING",
    payment_status: "UNPAID",
    invoice_numbers: null,
    general_remarks: null,
    sheet_tab: "ADD-BELL 2024",
    sheet_row: row,
    sheet_synced_at: "2026-08-01T00:00:00.000Z",
    sheet_sync_error: null,
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

function makeQueueItem(
  id: string,
  jobId: string,
  createdAt: string,
  attempts = 0
): QueueRow {
  return {
    id,
    job_id: jobId,
    status: "pending",
    attempts,
    last_error: null,
    created_at: createdAt,
  };
}

function createFakeAdmin(state: { queue: QueueRow[]; jobs: JobRow[] }) {
  const execute = (query: {
    table: string;
    action: "select" | "update";
    filters: Record<string, unknown>;
    inFilters: Record<string, unknown[]>;
    ltFilters: Record<string, number>;
    payload?: Record<string, unknown>;
    limit?: number;
    single?: boolean;
  }) => {
    if (query.table === "po_masterlist_sheet_writeback_queue") {
      let rows = [...state.queue];
      if (query.filters.id) {
        rows = rows.filter((row) => row.id === query.filters.id);
      }
      if (query.filters.job_id) {
        rows = rows.filter((row) => row.job_id === query.filters.job_id);
      }
      if (query.inFilters.status) {
        rows = rows.filter((row) =>
          query.inFilters.status.includes(row.status)
        );
      }
      if (query.ltFilters.attempts != null) {
        rows = rows.filter((row) => row.attempts < query.ltFilters.attempts);
      }
      rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (query.limit != null) rows = rows.slice(0, query.limit);

      if (query.action === "update") {
        const payload = query.payload ?? {};
        for (const row of rows) {
          Object.assign(row, payload);
        }
        const data = query.single ? rows[0] ?? null : rows;
        return Promise.resolve({ data, error: null });
      }

      return Promise.resolve({ data: query.single ? rows[0] ?? null : rows, error: null });
    }

    if (query.table === "po_masterlist_jobs") {
      let rows = [...state.jobs];
      if (query.filters.id) {
        rows = rows.filter((row) => row.id === query.filters.id);
      }
      if (query.action === "update") {
        const payload = query.payload ?? {};
        for (const row of rows) {
          Object.assign(row, payload);
        }
      }
      return Promise.resolve({
        data: query.single ? rows[0] ?? null : rows,
        error: null,
      });
    }

    return Promise.resolve({ data: query.single ? null : [], error: null });
  };

  const from = (table: string) => {
    const query: {
      table: string;
      action: "select" | "update";
      filters: Record<string, unknown>;
      inFilters: Record<string, unknown[]>;
      ltFilters: Record<string, number>;
      payload?: Record<string, unknown>;
      limit?: number;
      single?: boolean;
    } = {
      table,
      action: "select",
      filters: {},
      inFilters: {},
      ltFilters: {},
    };

    const thenable: Record<string, unknown> = {
      select() {
        return thenable;
      },
      update(payload: Record<string, unknown>) {
        query.action = "update";
        query.payload = payload;
        return thenable;
      },
      eq(column: string, value: unknown) {
        query.filters[column] = value;
        return thenable;
      },
      in(column: string, values: unknown[]) {
        query.inFilters[column] = values;
        return thenable;
      },
      lt(column: string, value: number) {
        query.ltFilters[column] = value;
        return thenable;
      },
      order() {
        return thenable;
      },
      limit(value: number) {
        query.limit = value;
        return thenable;
      },
      maybeSingle() {
        query.single = true;
        return execute(query);
      },
      single() {
        query.single = true;
        return execute(query);
      },
      then(
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return execute(query).then(onFulfilled, onRejected);
      },
    };

    return thenable;
  };

  return { from };
}

describe("P.O. masterlist sheet writeback quota", () => {
  beforeEach(() => {
    updateSheetRowMock.mockReset();
    updateSheetRowsMock.mockReset();
    updateSheetRowMock.mockResolvedValue(undefined);
    updateSheetRowsMock.mockResolvedValue(undefined);
    resetPoMasterlistSheetWritebackRuntimeState();
    vi.useRealTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("recognizes the Google Sheets write-requests-per-minute quota error", () => {
    expect(isPoMasterlistSheetWriteQuotaError(new Error(QUOTA_ERROR_MESSAGE))).toBe(
      true
    );
    expect(isPoMasterlistSheetWriteQuotaError(new Error("Job not found"))).toBe(
      false
    );
    expect(isPoMasterlistSheetWriteQuotaError(new Error("429 RESOURCE_EXHAUSTED"))).toBe(
      true
    );
  });

  it("does not keep issuing Google writes after a write-quota 429", async () => {
    const jobs = [makeJob("job-1", 4), makeJob("job-2", 5), makeJob("job-3", 6)];
    const queue = [
      makeQueueItem("q-1", "job-1", "2026-09-13T13:00:00.000Z"),
      makeQueueItem("q-2", "job-2", "2026-09-13T13:00:01.000Z"),
      makeQueueItem("q-3", "job-3", "2026-09-13T13:00:02.000Z"),
    ];
    const quotaError = new Error(QUOTA_ERROR_MESSAGE);
    updateSheetRowMock.mockRejectedValue(quotaError);
    updateSheetRowsMock.mockRejectedValue(quotaError);

    const result = await flushPoMasterlistSheetWritebackQueue({
      admin: createFakeAdmin({ queue, jobs }) as never,
      limit: 20,
    });

    expect(googleWriteCount()).toBe(1);
    expect(result.failed).toBeGreaterThan(0);
    expect(queue.every((item) => item.attempts < 5)).toBe(true);
    expect(queue.some((item) => item.status === "done")).toBe(false);
  });

  it("does not retry Google writes during the quota cooldown window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T21:00:00.000Z"));

    const jobs = [makeJob("job-1", 4), makeJob("job-2", 5)];
    const queue = [
      makeQueueItem("q-1", "job-1", "2026-09-13T13:00:00.000Z"),
      makeQueueItem("q-2", "job-2", "2026-09-13T13:00:01.000Z"),
    ];
    const quotaError = new Error(QUOTA_ERROR_MESSAGE);
    updateSheetRowMock.mockRejectedValue(quotaError);
    updateSheetRowsMock.mockRejectedValue(quotaError);
    const admin = createFakeAdmin({ queue, jobs }) as never;

    await flushPoMasterlistSheetWritebackQueue({ admin, limit: 20 });
    const writesAfterFirstFlush = googleWriteCount();

    await flushPoMasterlistSheetWritebackQueue({ admin, limit: 20 });
    expect(googleWriteCount()).toBe(writesAfterFirstFlush);

    vi.setSystemTime(new Date("2026-09-13T21:01:10.000Z"));
    await flushPoMasterlistSheetWritebackQueue({ admin, limit: 20 });
    expect(googleWriteCount()).toBeGreaterThan(writesAfterFirstFlush);
  });

  it("pushes many pending rows in one Google write", async () => {
    const jobs = [makeJob("job-1", 4), makeJob("job-2", 5), makeJob("job-3", 6)];
    const queue = [
      makeQueueItem("q-1", "job-1", "2026-09-13T13:00:00.000Z"),
      makeQueueItem("q-2", "job-2", "2026-09-13T13:00:01.000Z"),
      makeQueueItem("q-3", "job-3", "2026-09-13T13:00:02.000Z"),
    ];

    const result = await flushPoMasterlistSheetWritebackQueue({
      admin: createFakeAdmin({ queue, jobs }) as never,
      limit: 20,
    });

    expect(googleWriteCount()).toBe(1);
    expect(result.succeeded).toBe(3);
    expect(queue.every((item) => item.status === "done")).toBe(true);
    if (updateSheetRowsMock.mock.calls.length > 0) {
      expect(updateSheetRowsMock.mock.calls[0]?.[0]).toHaveLength(3);
    }
  });

  it("writes nothing when the queue is empty", async () => {
    const result = await flushPoMasterlistSheetWritebackQueue({
      admin: createFakeAdmin({ queue: [], jobs: [] }) as never,
    });
    expect(googleWriteCount()).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
  });

  it("still retries a quota item after cooldown instead of burning all 5 attempts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T21:00:00.000Z"));

    const jobs = [makeJob("job-1", 4)];
    const queue = [
      makeQueueItem("q-1", "job-1", "2026-09-13T13:00:00.000Z", 4),
    ];
    const quotaError = new Error(QUOTA_ERROR_MESSAGE);
    updateSheetRowMock.mockRejectedValue(quotaError);
    updateSheetRowsMock.mockRejectedValue(quotaError);
    const admin = createFakeAdmin({ queue, jobs }) as never;

    await flushPoMasterlistSheetWritebackQueue({ admin });
    expect(queue[0]?.attempts).toBe(4);
    expect(queue[0]?.status).not.toBe("done");

    vi.setSystemTime(new Date("2026-09-13T21:01:10.000Z"));
    await flushPoMasterlistSheetWritebackQueue({ admin });
    expect(queue[0]?.attempts).toBeLessThan(5);
  });

  it("writes the valid rows when one queued job cannot be mirrored", async () => {
    const validA = makeJob("job-1", 4);
    const invalid = makeJob("job-2", 5);
    invalid.sheet_tab = null;
    invalid.sheet_row = null;
    const validB = makeJob("job-3", 6);
    const jobs = [validA, invalid, validB];
    const queue = [
      makeQueueItem("q-1", "job-1", "2026-09-13T13:00:00.000Z"),
      makeQueueItem("q-2", "job-2", "2026-09-13T13:00:01.000Z"),
      makeQueueItem("q-3", "job-3", "2026-09-13T13:00:02.000Z"),
    ];

    const result = await flushPoMasterlistSheetWritebackQueue({
      admin: createFakeAdmin({ queue, jobs }) as never,
      limit: 20,
    });

    expect(googleWriteCount()).toBe(1);
    expect(updateSheetRowsMock.mock.calls[0]?.[0]).toHaveLength(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(queue[0]?.status).toBe("done");
    expect(queue[1]?.status).toBe("failed");
    expect(queue[1]?.attempts).toBe(1);
    expect(queue[2]?.status).toBe("done");
  });

  it("retries a non-quota Google error on the next flush instead of cooling down", async () => {
    const jobs = [makeJob("job-1", 4), makeJob("job-2", 5)];
    const queue = [
      makeQueueItem("q-1", "job-1", "2026-09-13T13:00:00.000Z"),
      makeQueueItem("q-2", "job-2", "2026-09-13T13:00:01.000Z"),
    ];
    updateSheetRowMock.mockRejectedValue(new Error("socket hang up"));
    updateSheetRowsMock.mockRejectedValue(new Error("socket hang up"));
    const admin = createFakeAdmin({ queue, jobs }) as never;

    await flushPoMasterlistSheetWritebackQueue({ admin, limit: 20 });
    expect(queue.every((item) => item.status === "failed")).toBe(true);
    expect(queue.every((item) => item.attempts === 1)).toBe(true);

    const writesAfterFirstFlush = googleWriteCount();
    await flushPoMasterlistSheetWritebackQueue({ admin, limit: 20 });
    expect(googleWriteCount()).toBeGreaterThan(writesAfterFirstFlush);
  });

  it("re-queues a failed item that already burned all quota attempts", async () => {
    const jobs = [makeJob("job-1", 4)];
    const queue: QueueRow[] = [
      {
        id: "q-1",
        job_id: "job-1",
        status: "failed",
        attempts: 5,
        last_error: QUOTA_ERROR_MESSAGE,
        created_at: "2026-09-13T13:00:00.000Z",
      },
    ];
    const admin = createFakeAdmin({ queue, jobs }) as never;

    await enqueuePoMasterlistSheetWriteback("job-1", admin);

    expect(queue[0]?.status).toBe("pending");
    expect(queue[0]?.attempts).toBe(0);

    const result = await flushPoMasterlistSheetWritebackQueue({ admin });
    expect(googleWriteCount()).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(queue[0]?.status).toBe("done");
  });
});
