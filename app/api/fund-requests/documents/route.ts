import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import { assertRequesterCanManageFundRequest, getAdminClient } from "@/lib/fund-request-api";
import { insertFundRequestDocument } from "@/lib/fund-request-document-storage";
export { dynamic } from "@/lib/api-route-segment";


type AddFundRequestDocumentPayload = {
  request_id?: string;
  requested_by?: string;
  document?: {
    file_name: string;
    file_type: string;
    file_size: number;
    file_base64: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AddFundRequestDocumentPayload;

    if (!body?.request_id?.trim() || !body?.requested_by?.trim()) {
      return NextResponse.json(
        { error: "request_id and requested_by are required" },
        { status: 400 }
      );
    }
    if (!body.document?.file_base64) {
      return NextResponse.json({ error: "document is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const cookieSupabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user: authUser },
    } = await cookieSupabase.auth.getUser();

    const access = await assertRequesterCanManageFundRequest(
      admin,
      authUser?.id ?? null,
      body.request_id.trim(),
      body.requested_by.trim()
    );
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const result = await insertFundRequestDocument(admin, {
      fundRequestId: body.request_id.trim(),
      employeeId: body.requested_by.trim(),
      fileName: body.document.file_name,
      fileType: body.document.file_type,
      fileBase64: body.document.file_base64,
      documentType: "supporting",
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

    return NextResponse.json({ document: result.document });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
