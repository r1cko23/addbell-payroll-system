import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SOURCE = "aaaaaaaa-0000-4000-8000-000000000001";
const PEER = "aaaaaaaa-0000-4000-8000-000000000002";
const OTHER_PAYEE = "aaaaaaaa-0000-4000-8000-000000000003";
const DOC = "dddddddd-0000-4000-8000-000000000001";

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createServerComponentClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "approver" } } }) } }),
}));
vi.mock("@/lib/api-helpers", () => ({ getCurrentUserRole: async () => "upper_management" }));
vi.mock("@/lib/platform-runtime-metrics", () => ({ recordFundRequestDirectUpload: () => {} }));
vi.mock("@/lib/fund-request-payment-check", () => ({
  isFundRequestPaymentCheckPeer: (_s: unknown, c: { id: string }) => c.id !== OTHER_PAYEE,
}));
vi.mock("@/lib/fund-request-api", () => ({
  getAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: { id }, error: null }) }) }),
    }),
  }),
  assertApproverCanUploadPaymentCheck: async (_a: unknown, _u: unknown, id: string) => ({ existing: { id, requested_by: `emp-${id}` } }),
  assertRequesterCanAddDocumentToFundRequest: async () => ({ existing: {} }),
}));

const register = vi.fn(async () => ({ document: { id: DOC } }));
const link = vi.fn(async (): Promise<{ documents: unknown[] } | { error: string; status: number }> => ({ documents: [{ id: "linked" }] }));
const deleteDoc = vi.fn(async () => ({}));
vi.mock("@/lib/fund-request-document-storage", () => ({
  registerFundRequestDocument: register,
  linkFundRequestDocumentToRequests: link,
  deleteFundRequestDocumentById: deleteDoc,
}));

async function confirm(linked: string[]) {
  const { POST } = await import("@/app/api/fund-requests/documents/confirm/route");
  return POST(
    new NextRequest("http://localhost/api/fund-requests/documents/confirm", {
      method: "POST",
      body: JSON.stringify({
        request_id: SOURCE,
        document_id: DOC,
        storage_path: `${SOURCE}/${DOC}/cheque.pdf`,
        file_name: "cheque.pdf",
        file_type: "application/pdf",
        file_size: 1000,
        document_type: "payment_check",
        linked_request_ids: linked,
      }),
    })
  );
}

describe("POST /api/fund-requests/documents/confirm (payment checks)", () => {
  beforeEach(() => {
    register.mockClear();
    link.mockClear();
    deleteDoc.mockClear();
  });

  it("saves the cheque on the source and every peer", async () => {
    const res = await confirm([SOURCE, PEER]);
    expect(res.status).toBe(200);
    expect(link).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      linkedRequests: [{ fundRequestId: PEER, employeeId: `emp-${PEER}` }],
    }));
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("saves nothing when a linked request is for another payee", async () => {
    const res = await confirm([PEER, OTHER_PAYEE]);
    expect(res.status).toBe(400);
    expect(register).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
  });

  it("undoes the source cheque when linking the peers fails", async () => {
    link.mockResolvedValueOnce({ error: "insert failed", status: 500 });
    const res = await confirm([PEER]);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Nothing was saved/);
    expect(deleteDoc).toHaveBeenCalledWith(expect.anything(), DOC);
  });
});
