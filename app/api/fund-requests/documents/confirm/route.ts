import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import {
  assertApproverCanUploadPaymentCheck,
  assertRequesterCanManageFundRequest,
  getAdminClient,
} from "@/lib/fund-request-api";
import { getCurrentUserRole } from "@/lib/api-helpers";
import { registerFundRequestDocument } from "@/lib/fund-request-document-storage";
import { recordFundRequestDirectUpload } from "@/lib/platform-runtime-metrics";
import type { FundRequestDocumentType } from "@/types/fund-request";

type ConfirmUploadPayload = {
  request_id?: string;
  requested_by?: string;
  document_type?: FundRequestDocumentType;
  document_id?: string;
  storage_path?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConfirmUploadPayload;
    const requestId = body.request_id?.trim();
    const documentId = body.document_id?.trim();
    const storagePath = body.storage_path?.trim();
    const fileName = body.file_name?.trim();
    const fileType = body.file_type?.trim() || "application/octet-stream";
    const fileSize = Number(body.file_size ?? 0);
    const documentType = body.document_type ?? "supporting";

    if (
      !requestId ||
      !documentId ||
      !storagePath ||
      !fileName ||
      !Number.isFinite(fileSize) ||
      fileSize <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "request_id, document_id, storage_path, file_name, and file_size are required",
        },
        { status: 400 }
      );
    }

    if (!storagePath.startsWith(`${requestId}/`)) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    }

    const admin = getAdminClient();
    const cookieSupabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user: authUser },
    } = await cookieSupabase.auth.getUser();

    let employeeId: string;

    if (documentType === "payment_check") {
      const role = await getCurrentUserRole();
      const access = await assertApproverCanUploadPaymentCheck(
        admin,
        authUser?.id ?? null,
        requestId,
        role
      );
      if ("error" in access) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      employeeId = access.existing.requested_by;
    } else {
      if (!body.requested_by?.trim()) {
        return NextResponse.json(
          { error: "requested_by is required" },
          { status: 400 }
        );
      }
      const access = await assertRequesterCanManageFundRequest(
        admin,
        authUser?.id ?? null,
        requestId,
        body.requested_by.trim()
      );
      if ("error" in access) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      employeeId = body.requested_by.trim();
    }

    const result = await registerFundRequestDocument(admin, {
      documentId,
      fundRequestId: requestId,
      employeeId,
      fileName,
      fileType,
      fileSize,
      storagePath,
      documentType,
      uploadedBy: documentType === "payment_check" ? authUser?.id ?? null : null,
    });

    if ("error" in result) {
      if (isSchemaMissingTableOrRelationError({ message: result.error })) {
        return NextResponse.json(
          { error: "Document storage is not available. Apply database migrations." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    recordFundRequestDirectUpload(fileSize);

    return NextResponse.json({ document: result.document });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
