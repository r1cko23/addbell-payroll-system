/**
 * Employee portal reads for fund requests. Portal users have no Supabase JWT, so
 * these reads run with the service role here and are scoped to the employee in
 * the signed portal session (never an id sent by the browser).
 *
 *   ?id=<fund request id>        one of the employee's own requests, with project,
 *                                vendor name, documents and requester name
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   the employee's own requests created in range
 *   ?options=subcontractors      active subcontractors for the request form
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePortalEmployee } from "@/lib/portal-session";
import { getAdminClient } from "@/lib/fund-request-api";

export const dynamic = "force-dynamic";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const portal = requirePortalEmployee();
  if (portal instanceof NextResponse) return portal;
  const employeeId = portal.employeeId;
  const params = req.nextUrl.searchParams;
  const admin = getAdminClient();

  try {
    if (params.get("options") === "subcontractors") {
      const { data, error } = await admin
        .from("vendors")
        .select("id, name, account_name")
        .eq("is_active", true)
        .eq("type", "subcontractor")
        .order("name");
      if (error) throw error;
      return NextResponse.json({ subcontractors: data ?? [] });
    }

    const id = params.get("id");
    if (id) {
      const { data: request, error } = await admin
        .from("fund_requests")
        .select("*")
        .eq("id", id)
        .eq("requested_by", employeeId)
        .maybeSingle();
      if (error) throw error;
      if (!request) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      const row = request as { project_id?: string | null; vendor_id?: string | null };
      const [requester, project, vendor, documents] = await Promise.all([
        admin.from("employees").select("full_name").eq("id", employeeId).maybeSingle(),
        row.project_id
          ? admin
              .from("projects")
              .select("name, code, site_address")
              .eq("id", row.project_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        row.vendor_id
          ? admin.from("vendors").select("name").eq("id", row.vendor_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        admin
          .from("fund_request_documents")
          .select(
            "id, fund_request_id, employee_id, file_name, file_type, file_size, created_at, document_type"
          )
          .eq("fund_request_id", id)
          .order("created_at", { ascending: true }),
      ]);
      if (documents.error) throw documents.error;

      return NextResponse.json({
        request,
        requesterName: (requester.data as { full_name?: string } | null)?.full_name ?? "",
        project: project.data ?? null,
        vendorName: (vendor.data as { name?: string } | null)?.name ?? "",
        documents: documents.data ?? [],
      });
    }

    const from = params.get("from");
    const to = params.get("to");
    let query = admin
      .from("fund_requests")
      .select("*, projects ( name, code ), vendors ( name )")
      .eq("requested_by", employeeId)
      .order("created_at", { ascending: false });
    if (from && YMD.test(from)) query = query.gte("created_at", `${from}T00:00:00+08:00`);
    if (to && YMD.test(to)) query = query.lte("created_at", `${to}T23:59:59+08:00`);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
