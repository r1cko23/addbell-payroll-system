import { describe, expect, it } from "vitest";
import {
  canViewFundRequestPaymentChecksInInbox,
  loadFundRequestPaymentCheckDocumentsByRequestId,
} from "@/lib/fund-request-payment-check";
import type { FundRequestDocumentSummary } from "@/types/fund-request";

function doc(id: string, fundRequestId: string): FundRequestDocumentSummary {
  return {
    id,
    fund_request_id: fundRequestId,
    employee_id: "emp",
    file_name: `${id}.jpg`,
    file_type: "image/jpeg",
    file_size: 1,
    created_at: "2026-11-04T00:00:00Z",
    document_type: "payment_check",
    storage_path: `${fundRequestId}/${id}.jpg`,
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `req-${i}`);

describe("loadFundRequestPaymentCheckDocumentsByRequestId", () => {
  it("loads cheques for 630 requests without sending an oversized filter", async () => {
    const requestIds = ids(630);
    const stored = [doc("a", "req-0"), doc("b", "req-0"), doc("c", "req-629")];
    const batchSizes: number[] = [];

    const result = await loadFundRequestPaymentCheckDocumentsByRequestId(
      requestIds,
      async (batch) => {
        batchSizes.push(batch.length);
        // The Supabase gateway rejects the GET once the id list gets this long.
        if (batch.length > 100) return { data: null, error: { message: "Bad Request" } };
        return { data: stored.filter((d) => batch.includes(d.fund_request_id)), error: null };
      }
    );

    expect(result.error).toBeUndefined();
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(100);
    expect(batchSizes.reduce((a, b) => a + b, 0)).toBe(630);
    expect(result.documents["req-0"]?.map((d) => d.id)).toEqual(["a", "b"]);
    expect(result.documents["req-629"]?.map((d) => d.id)).toEqual(["c"]);
  });

  it("makes no request for zero ids", async () => {
    let calls = 0;
    const result = await loadFundRequestPaymentCheckDocumentsByRequestId([], async () => {
      calls += 1;
      return { data: [], error: null };
    });
    expect(calls).toBe(0);
    expect(result).toEqual({ documents: {} });
  });

  it("reports an error instead of returning an empty list when a batch fails", async () => {
    const result = await loadFundRequestPaymentCheckDocumentsByRequestId(ids(150), async (batch) =>
      batch.includes("req-120")
        ? { data: null, error: { message: "Bad Request" } }
        : { data: [doc("a", "req-0")], error: null }
    );
    expect(result.error).toBe("Bad Request");
  });
});

describe("canViewFundRequestPaymentChecksInInbox", () => {
  it.each([
    ["upper_management", true],
    ["admin", true],
    ["purchasing_officer", false],
    ["hr", false],
    [null, false],
  ])("%s -> %s", (role, expected) => {
    expect(canViewFundRequestPaymentChecksInInbox(role)).toBe(expected);
  });
});
