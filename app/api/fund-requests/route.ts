import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import type { FundRequestReferenceMode } from "@/types/fund-request";

type CreateFundRequestPayload = {
  company_id: string | null;
  reference_mode: FundRequestReferenceMode;
  project_id: string | null;
  requested_by: string;
  request_date: string;
  purpose: string;
  po_number: string | null;
  project_title: string | null;
  project_location: string | null;
  vendor_id: string | null;
  vendor_po_number: string | null;
  po_amount: number | null;
  po_amount_percentage: number | null;
  current_project_percentage: number | null;
  details: Array<{ description: string; amount: number }>;
  total_requested_amount: number;
  date_needed: string | null;
  remarks: string | null;
  urgent_reason: string | null;
  status: string;
  project_manager_approved_by: string | null;
  project_manager_approved_at: string | null;
  purchasing_officer_approved_by: string | null;
  purchasing_officer_approved_at: string | null;
  management_approved_by: string | null;
  management_approved_at: string | null;
  document?: {
    file_name: string;
    file_type: string;
    file_size: number;
    file_base64: string;
  } | null;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateFundRequestPayload;

    if (!body?.requested_by?.trim()) {
      return NextResponse.json({ error: "requested_by is required" }, { status: 400 });
    }
    if (!body?.purpose?.trim()) {
      return NextResponse.json({ error: "purpose is required" }, { status: 400 });
    }
    if (!Array.isArray(body.details) || body.details.length === 0) {
      return NextResponse.json({ error: "At least one detail item is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: inserted, error } = await admin
      .from("fund_requests")
      .insert({
        company_id: body.company_id,
        reference_mode: body.reference_mode,
        project_id: body.project_id,
        requested_by: body.requested_by,
        request_date: body.request_date,
        purpose: body.purpose,
        po_number: body.po_number,
        project_title: body.project_title,
        project_location: body.project_location,
        vendor_id: body.vendor_id,
        vendor_po_number: body.vendor_po_number,
        po_amount: body.po_amount,
        po_amount_percentage: body.po_amount_percentage,
        current_project_percentage: body.current_project_percentage,
        details: body.details,
        total_requested_amount: body.total_requested_amount,
        date_needed: body.date_needed,
        remarks: body.remarks?.trim() || null,
        urgent_reason: body.urgent_reason?.trim() || null,
        status: body.status,
        project_manager_approved_by: body.project_manager_approved_by,
        project_manager_approved_at: body.project_manager_approved_at,
        purchasing_officer_approved_by: body.purchasing_officer_approved_by,
        purchasing_officer_approved_at: body.purchasing_officer_approved_at,
        management_approved_by: body.management_approved_by,
        management_approved_at: body.management_approved_at,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message || "Failed to create fund request" },
        { status: 500 }
      );
    }

    if (body.document?.file_base64) {
      const docInsert = await admin.from("fund_request_documents").insert({
        fund_request_id: inserted.id,
        employee_id: body.requested_by,
        file_name: body.document.file_name,
        file_type: body.document.file_type,
        file_size: body.document.file_size,
        file_base64: body.document.file_base64,
      });

      if (docInsert.error) {
        if (isSchemaMissingTableOrRelationError(docInsert.error)) {
          return NextResponse.json({
            id: inserted.id,
            warning:
              "Fund request saved; document storage is not available. Apply database migrations to enable attachments.",
          });
        }
        return NextResponse.json({
          id: inserted.id,
          warning: `Fund request created but document upload failed: ${docInsert.error.message}`,
        });
      }
    }

    return NextResponse.json({ id: inserted.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
