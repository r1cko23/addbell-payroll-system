import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { getAdminClient } from "@/lib/fund-request-api";
import { mergePermissions } from "@/lib/permissions";
import {
  getEditablePoMasterlistColumnsForRole,
  partitionPoMasterlistPatchFields,
  type PoMasterlistEditableColumn,
} from "@/lib/po-masterlist-column-acl";
import { schedulePoMasterlistSheetWriteback } from "@/lib/po-masterlist-sheet-writeback";
import { syncCatalogFromMasterlistJob } from "@/lib/po-masterlist-job-sync";
import type { PoMasterlistJob } from "@/types/po-masterlist";

export { dynamic } from "@/lib/api-route-segment";

type RouteContext = { params: { id: string } };

async function getProjectsUpdateAccess(): Promise<{
  userId: string;
  role: string;
} | null> {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, permissions, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) return null;

  const permissions = mergePermissions(
    profile.role,
    profile.permissions as Parameters<typeof mergePermissions>[1]
  );

  if (!permissions.projects.read || !permissions.projects.update) {
    return null;
  }

  return { userId: user.id, role: profile.role };
}

function normalizePatchValue(
  field: PoMasterlistEditableColumn,
  value: unknown
): unknown {
  if (value === "") return null;
  if (field === "po_amount") {
    if (value == null) return null;
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  }
  if (typeof value === "string") return value.trim() || null;
  return value;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const access = await getProjectsUpdateAccess();
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const jobId = context.params.id?.trim();
    if (!jobId) {
      return NextResponse.json({ error: "Job id is required" }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const { allowed, forbidden, unknown } = partitionPoMasterlistPatchFields(
      access.role,
      body
    );

    if (forbidden.length > 0 || unknown.length > 0) {
      return NextResponse.json(
        {
          error: "One or more fields cannot be updated with your role",
          fields: [...forbidden, ...unknown],
          editableColumns: getEditablePoMasterlistColumnsForRole(access.role),
        },
        { status: 403 }
      );
    }

    const entries = Object.entries(allowed);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No editable fields provided" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const [key, value] of entries) {
      updates[key] = normalizePatchValue(
        key as PoMasterlistEditableColumn,
        value
      );
    }

    const admin = getAdminClient();
    const { data: updated, error } = await admin
      .from("po_masterlist_jobs")
      .update(updates)
      .eq("id", jobId)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message ?? "Job not found" },
        { status: error ? 500 : 404 }
      );
    }

    let job = updated as unknown as PoMasterlistJob;
    const needsCatalogSync =
      "project_title" in allowed ||
      "location" in allowed ||
      "client_name" in allowed ||
      "project_status" in allowed ||
      "po_amount" in allowed ||
      "po_date" in allowed;

    if (needsCatalogSync) {
      await syncCatalogFromMasterlistJob(admin, job);
      const { data: refreshed } = await admin
        .from("po_masterlist_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (refreshed) job = refreshed as unknown as PoMasterlistJob;
    }

    schedulePoMasterlistSheetWriteback(job.id);

    return NextResponse.json({
      job,
      editableColumns: getEditablePoMasterlistColumnsForRole(access.role),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update job" },
      { status: 500 }
    );
  }
}
