import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import {
  assertCanViewFundRequestDocument,
  getAdminClient,
} from "@/lib/fund-request-api";
import { createFundRequestDocumentSignedUrl } from "@/lib/fund-request-document-storage";

export { dynamic } from "@/lib/api-route-segment";

type FundRequestDocumentRow = {
  file_name: string | null;
  file_type: string | null;
  storage_path: string | null;
  file_base64: string | null;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id?.trim();
    if (!documentId) {
      return NextResponse.json({ error: "Document id is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const cookieSupabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user: authUser },
    } = await cookieSupabase.auth.getUser();

    const requestedBy = req.nextUrl.searchParams.get("requested_by");
    const access = await assertCanViewFundRequestDocument(
      admin,
      authUser?.id ?? null,
      documentId,
      requestedBy
    );

    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const document = access.document as FundRequestDocumentRow;

    if (document.storage_path) {
      const signedUrl = await createFundRequestDocumentSignedUrl(
        admin,
        document.storage_path
      );
      if (!signedUrl) {
        return NextResponse.json(
          { error: "Unable to open document from storage" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        url: signedUrl,
        file_name: document.file_name,
        file_type: document.file_type,
      });
    }

    if (!document.file_base64) {
      return NextResponse.json({ error: "Document content is unavailable" }, { status: 404 });
    }

    return NextResponse.json({
      file_base64: document.file_base64,
      file_name: document.file_name,
      file_type: document.file_type,
    });
  } catch (err: unknown) {
    if (err instanceof Error && isSchemaMissingTableOrRelationError(err)) {
      return NextResponse.json(
        { error: "Document storage is not available. Apply database migrations." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
