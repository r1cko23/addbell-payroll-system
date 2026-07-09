import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import {
  assertApproverCanUploadPaymentCheck,
  assertRequesterCanAddDocumentToFundRequest,
  getAdminClient,
} from "@/lib/fund-request-api";
import { getCurrentUserRole } from "@/lib/api-helpers";
import { createFundRequestDocumentUploadSession } from "@/lib/fund-request-document-storage";
import type { FundRequestDocumentType } from "@/types/fund-request";

export { dynamic } from "@/lib/api-route-segment";

type UploadUrlPayload = {
  request_id?: string;
  requested_by?: string;
  document_type?: FundRequestDocumentType;
  file_name?: string;
  file_size?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UploadUrlPayload;
    const requestId = body.request_id?.trim();
    const fileName = body.file_name?.trim();
    const fileSize = Number(body.file_size ?? 0);
    const documentType = body.document_type ?? "supporting";

    if (!requestId || !fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "request_id, file_name, and file_size are required" },
        { status: 400 }
      );
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
      const access = await assertRequesterCanAddDocumentToFundRequest(
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

    const session = await createFundRequestDocumentUploadSession(admin, {
      fundRequestId: requestId,
      fileName,
      fileSize,
    });

    if ("error" in session) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    return NextResponse.json({
      ...session.session,
      employee_id: employeeId,
      document_type: documentType,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
