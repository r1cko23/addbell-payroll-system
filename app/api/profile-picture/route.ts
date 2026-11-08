import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getAdminClient } from "@/lib/fund-request-api";
import { requirePortalEmployee } from "@/lib/portal-session";
export { dynamic } from "@/lib/api-route-segment";

const BUCKET = "profile-pictures";
const MAX_BYTES = 200 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Owner = { table: "profiles" | "employees"; column: "avatar_url" | "profile_picture_url"; id: string; folder: string };

/** Who the picture belongs to: the staff login, or the employee in the signed portal session. */
async function resolveOwner(as: string | null): Promise<Owner | NextResponse> {
  if (as === "employee") {
    const portal = requirePortalEmployee(null);
    if (portal instanceof NextResponse) return portal;
    return { table: "employees", column: "profile_picture_url", id: portal.employeeId, folder: `employees/${portal.employeeId}` };
  }
  if (as === "user") {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    return { table: "profiles", column: "avatar_url", id: user.id, folder: `users/${user.id}` };
  }
  return NextResponse.json({ error: "as must be user or employee" }, { status: 400 });
}

async function setPicture(owner: Owner, url: string | null) {
  const admin = getAdminClient();
  const { error } = await admin.from(owner.table).update({ [owner.column]: url }).eq("id", owner.id);
  if (error) return error.message;

  // Old pictures are no longer referenced; a failed clean-up only leaves a stray file.
  const { data: files } = await admin.storage.from(BUCKET).list(owner.folder);
  const stale = (files ?? []).map((f) => `${owner.folder}/${f.name}`).filter((p) => !url?.endsWith(`/${p}`));
  if (stale.length) await admin.storage.from(BUCKET).remove(stale);
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const owner = await resolveOwner(String(form.get("as") ?? ""));
    if (owner instanceof NextResponse) return owner;

    const file = form.get("file");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "No image was sent." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large. Max size is 200KB." }, { status: 400 });

    const admin = getAdminClient();
    const path = `${owner.folder}/${randomUUID()}.${file.type.split("/")[1]}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const saveError = await setPicture(owner, url);
    if (saveError) {
      await admin.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: saveError }, { status: 500 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const owner = await resolveOwner(req.nextUrl.searchParams.get("as"));
    if (owner instanceof NextResponse) return owner;
    const saveError = await setPicture(owner, null);
    if (saveError) return NextResponse.json({ error: saveError }, { status: 500 });
    return NextResponse.json({ url: null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Remove failed" }, { status: 500 });
  }
}
