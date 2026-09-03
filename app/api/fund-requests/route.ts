import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import type { FundRequestReferenceMode } from "@/types/fund-request";
import type { Database } from "@/types/database";
import {
  getFundRequestSubmissionWorkflow,
  isPurchasingOfficerSelfSubmitPath,
  resolveFundRequestRequesterRouting,
} from "@/lib/fund-request-routing";
import {
  parseSupplierBankDetails,
  validateFundRequestBankDetails,
} from "@/lib/fund-request-bank-details";
import { assertRequesterCanManageFundRequest, assertRequesterCanUpdateFundRequestPoNumber, getAdminClient } from "@/lib/fund-request-api";
import { buildFundRequestPoNumberColumnUpdates } from "@/lib/fund-request-requester-edit";
import { normalizeUserRole } from "@/lib/user-roles";
import { isSubcontractorPaymentPurpose } from "@/types/fund-request";
import { validateSubcontractorPoAmountInput } from "@/lib/fund-request-subcontractor-po-amount";
import { insertFundRequestDocument } from "@/lib/fund-request-document-storage";

export { dynamic } from "@/lib/api-route-segment";

type PoNumberOnlyUpdatePayload = {
  update_mode: "po_number";
  request_id: string;
  requested_by: string;
  po_number: string | null;
};

type FundRequestContentPayload = {
  reference_mode: FundRequestReferenceMode;
  request_date: string;
  purpose: string;
  po_number: string | null;
  project_title: string | null;
  project_location: string | null;
  project_details?: unknown;
  vendor_id: string | null;
  vendor_po_number: string | null;
  po_amount: number | null;
  po_amount_percentage: number | null;
  current_project_percentage: number | null;
  subcontractor_progress_completion_percentage: number | null;
  subcontractor_po_amount?: number | null;
  details: Array<{
    description: string;
    amount: number;
    kind?: "item" | "deduction";
    base_amount?: number;
    vat_mode?: "inclusive" | "exclusive" | null;
    ewt_rate?: 1 | 2 | null;
  }>;
  total_requested_amount: number;
  date_needed: string | null;
  remarks: string | null;
  urgent_reason: string | null;
  supplier_bank_details?: string | null;
  document?: {
    file_name: string;
    file_type: string;
    file_size: number;
    file_base64: string;
  } | null;
};

type CreateFundRequestPayload = FundRequestContentPayload & {
  company_id: string | null;
  requested_by: string;
  status: string;
  project_manager_approved_by: string | null;
  project_manager_approved_at: string | null;
  purchasing_officer_approved_by: string | null;
  purchasing_officer_approved_at: string | null;
  management_approved_by: string | null;
  management_approved_at: string | null;
  is_portal_submission?: boolean;
};

type UpdateFundRequestPayload = FundRequestContentPayload & {
  request_id: string;
  requested_by: string;
};

function requiresSupplierBankDetailsFromRequester(options: {
  submitterRole: string | null | undefined;
  isPortal: boolean;
  submitterUserId: string | null;
  requestStatus: string;
}): boolean {
  if (options.requestStatus !== "purchasing_officer_approved") return false;
  return (
    isPurchasingOfficerSelfSubmitPath({
      submitterRole: options.submitterRole,
      isPortal: options.isPortal,
      submitterUserId: options.submitterUserId,
    }) ||
    normalizeUserRole(options.submitterRole) === "purchasing_officer"
  );
}

function validateSupplierBankDetailsPayload(
  raw: string | null | undefined
): string | null {
  return validateFundRequestBankDetails(parseSupplierBankDetails(raw));
}

function requiresSubcontractorPoAmountFromPurchasing(options: {
  submitterRole: string | null | undefined;
  isPortal: boolean;
  submitterUserId: string | null;
  requestStatus: string;
  purpose: string;
}): boolean {
  if (!isSubcontractorPaymentPurpose(options.purpose)) return false;
  if (options.requestStatus !== "purchasing_officer_approved") return false;
  return (
    isPurchasingOfficerSelfSubmitPath({
      submitterRole: options.submitterRole,
      isPortal: options.isPortal,
      submitterUserId: options.submitterUserId,
    }) || normalizeUserRole(options.submitterRole) === "purchasing_officer"
  );
}

function validateSubcontractorPoAmountPayload(
  value: number | null | undefined
): string | null {
  if (value == null) {
    return validateSubcontractorPoAmountInput("");
  }
  return validateSubcontractorPoAmountInput(String(value));
}

function buildFundRequestContentUpdate(body: FundRequestContentPayload) {
  return {
    reference_mode: body.reference_mode,
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
    subcontractor_progress_completion_percentage:
      body.subcontractor_progress_completion_percentage,
    ...(body.subcontractor_po_amount !== undefined
      ? { subcontractor_po_amount: body.subcontractor_po_amount }
      : {}),
    project_details: body.project_details ?? null,
    details: body.details,
    total_requested_amount: body.total_requested_amount,
    date_needed: body.date_needed,
    remarks: body.remarks?.trim() || null,
    urgent_reason: body.urgent_reason?.trim() || null,
    ...(body.supplier_bank_details !== undefined
      ? { supplier_bank_details: body.supplier_bank_details?.trim() || null }
      : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as UpdateFundRequestPayload | PoNumberOnlyUpdatePayload;

    if (!body?.request_id?.trim() || !body?.requested_by?.trim()) {
      return NextResponse.json(
        { error: "request_id and requested_by are required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const cookieSupabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user: authUser },
    } = await cookieSupabase.auth.getUser();

    // NTP / PO-to-follow correction — PO# only once client PO is on Projects.
    if ("update_mode" in body && body.update_mode === "po_number") {
      const poBody = body as PoNumberOnlyUpdatePayload;
      const access = await assertRequesterCanUpdateFundRequestPoNumber(
        admin,
        authUser?.id ?? null,
        poBody.request_id.trim(),
        poBody.requested_by.trim()
      );
      if ("error" in access) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }

      const nextPo =
        typeof poBody.po_number === "string" ? poBody.po_number.trim() : "";
      if (!nextPo) {
        return NextResponse.json(
          { error: "Enter the client PO number from Operations → Projects." },
          { status: 400 }
        );
      }

      const columns = buildFundRequestPoNumberColumnUpdates(access.existing, nextPo);
      const { error } = await admin
        .from("fund_requests")
        .update({
          po_number: columns.po_number,
          project_details: columns.project_details,
          updated_at: new Date().toISOString(),
        })
        .eq("id", poBody.request_id.trim())
        .eq("requested_by", poBody.requested_by.trim());

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        id: poBody.request_id.trim(),
        po_number: columns.po_number,
      });
    }

    const fullBody = body as UpdateFundRequestPayload;

    if (!fullBody?.purpose?.trim()) {
      return NextResponse.json({ error: "purpose is required" }, { status: 400 });
    }
    if (!Array.isArray(fullBody.details) || fullBody.details.length === 0) {
      return NextResponse.json({ error: "At least one detail item is required" }, { status: 400 });
    }

    const access = await assertRequesterCanManageFundRequest(
      admin,
      authUser?.id ?? null,
      fullBody.request_id.trim(),
      fullBody.requested_by.trim()
    );
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    let submitterRole: string | null = null;
    if (authUser?.id) {
      const { data: submitterProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();
      submitterRole = submitterProfile?.role ?? null;
    }

    if (
      requiresSupplierBankDetailsFromRequester({
        submitterRole,
        isPortal: false,
        submitterUserId: authUser?.id ?? null,
        requestStatus: access.existing.status,
      })
    ) {
      const bankValidationError = validateSupplierBankDetailsPayload(
        fullBody.supplier_bank_details
      );
      if (bankValidationError) {
        return NextResponse.json({ error: bankValidationError }, { status: 400 });
      }
    }

    if (
      requiresSubcontractorPoAmountFromPurchasing({
        submitterRole,
        isPortal: false,
        submitterUserId: authUser?.id ?? null,
        requestStatus: access.existing.status,
        purpose: fullBody.purpose,
      })
    ) {
      const subconPoError = validateSubcontractorPoAmountPayload(
        fullBody.subcontractor_po_amount
      );
      if (subconPoError) {
        return NextResponse.json({ error: subconPoError }, { status: 400 });
      }
    }

    const { error } = await admin
      .from("fund_requests")
      .update(buildFundRequestContentUpdate(fullBody))
      .eq("id", fullBody.request_id.trim())
      .eq("requested_by", fullBody.requested_by.trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (fullBody.document?.file_base64) {
      const docResult = await insertFundRequestDocument(admin, {
        fundRequestId: fullBody.request_id.trim(),
        employeeId: fullBody.requested_by.trim(),
        fileName: fullBody.document.file_name,
        fileType: fullBody.document.file_type,
        fileBase64: fullBody.document.file_base64,
        documentType: "supporting",
      });

      if ("error" in docResult && !isSchemaMissingTableOrRelationError({ message: docResult.error })) {
        return NextResponse.json({
          id: fullBody.request_id.trim(),
          warning: `Fund request updated but document upload failed: ${docResult.error}`,
        });
      }
    }

    return NextResponse.json({ id: fullBody.request_id.trim() });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
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
    const cookieSupabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user: authUser },
    } = await cookieSupabase.auth.getUser();
    let submitterRole: string | null = null;
    if (authUser?.id) {
      const { data: submitterProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();
      submitterRole = submitterProfile?.role ?? null;
    }

    const requesterRouting = await resolveFundRequestRequesterRouting(
      admin,
      body.requested_by.trim()
    );

    let isOwnEmployeeRequest = false;
    if (authUser?.id) {
      const [{ data: requesterEmployee }, { data: submitterProfile }] =
        await Promise.all([
          admin
            .from("employees")
            .select("user_id, email")
            .eq("id", body.requested_by.trim())
            .maybeSingle(),
          admin
            .from("profiles")
            .select("email")
            .eq("id", authUser.id)
            .maybeSingle(),
        ]);
      if (requesterEmployee?.user_id === authUser.id) {
        isOwnEmployeeRequest = true;
      } else {
        const submitterEmail = submitterProfile?.email?.trim().toLowerCase();
        const requesterEmail = requesterEmployee?.email?.trim().toLowerCase();
        if (submitterEmail && requesterEmail && submitterEmail === requesterEmail) {
          isOwnEmployeeRequest = true;
        }
      }
    }

    const isPortalSubmission = body.is_portal_submission === true;
    const workflow = getFundRequestSubmissionWorkflow({
      submitterRole,
      isPortal: isPortalSubmission,
      submitterUserId: authUser?.id ?? null,
      requiresOperationsManagerApproval:
        requesterRouting.requiresOperationsManagerApproval,
      isOwnEmployeeRequest,
    });

    if (
      requiresSupplierBankDetailsFromRequester({
        submitterRole,
        isPortal: isPortalSubmission,
        submitterUserId: authUser?.id ?? null,
        requestStatus: workflow.status,
      })
    ) {
      const bankValidationError = validateSupplierBankDetailsPayload(
        body.supplier_bank_details
      );
      if (bankValidationError) {
        return NextResponse.json({ error: bankValidationError }, { status: 400 });
      }
    }

    if (
      requiresSubcontractorPoAmountFromPurchasing({
        submitterRole,
        isPortal: isPortalSubmission,
        submitterUserId: authUser?.id ?? null,
        requestStatus: workflow.status,
        purpose: body.purpose,
      })
    ) {
      const subconPoError = validateSubcontractorPoAmountPayload(
        body.subcontractor_po_amount
      );
      if (subconPoError) {
        return NextResponse.json({ error: subconPoError }, { status: 400 });
      }
    }

    const { data: inserted, error } = await admin
      .from("fund_requests")
      .insert({
        company_id: body.company_id,
        reference_mode: body.reference_mode,
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
        subcontractor_progress_completion_percentage:
          body.subcontractor_progress_completion_percentage,
        subcontractor_po_amount: body.subcontractor_po_amount ?? null,
        project_details: body.project_details ?? null,
        details: body.details,
        total_requested_amount: body.total_requested_amount,
        date_needed: body.date_needed,
        remarks: body.remarks?.trim() || null,
        urgent_reason: body.urgent_reason?.trim() || null,
        status: workflow.status,
        project_manager_approved_by: workflow.project_manager_approved_by,
        project_manager_approved_at: workflow.project_manager_approved_at,
        purchasing_officer_approved_by: workflow.purchasing_officer_approved_by,
        purchasing_officer_approved_at: workflow.purchasing_officer_approved_at,
        management_approved_by: workflow.management_approved_by,
        management_approved_at: workflow.management_approved_at,
        supplier_bank_details: body.supplier_bank_details?.trim() || null,
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
      const docResult = await insertFundRequestDocument(admin, {
        fundRequestId: inserted.id,
        employeeId: body.requested_by,
        fileName: body.document.file_name,
        fileType: body.document.file_type,
        fileBase64: body.document.file_base64,
        documentType: "supporting",
      });

      if ("error" in docResult) {
        if (isSchemaMissingTableOrRelationError({ message: docResult.error })) {
          return NextResponse.json({
            id: inserted.id,
            warning:
              "Fund request saved; document storage is not available. Apply database migrations to enable attachments.",
          });
        }
        return NextResponse.json({
          id: inserted.id,
          warning: `Fund request created but document upload failed: ${docResult.error}`,
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

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      request_id?: string;
      requested_by?: string;
    };

    if (!body?.request_id?.trim() || !body?.requested_by?.trim()) {
      return NextResponse.json(
        { error: "request_id and requested_by are required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("fund_requests")
      .delete()
      .eq("id", body.request_id)
      .eq("requested_by", body.requested_by)
      .in("status", ["pending", "project_manager_approved", "purchasing_officer_approved"])
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Request not found or cannot be deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
