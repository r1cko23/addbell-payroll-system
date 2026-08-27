import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/lib/api-helpers";
import {
  ACCESS_CAPABILITY_KEYS,
  grantsToUserPermissions,
  userPermissionsToGrantKeys,
} from "@/lib/access";
import { mergePermissions, type UserPermissions } from "@/lib/permissions";
export { dynamic } from "@/lib/api-route-segment";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/access/grants?userId=
 * Returns grant keys for a user. If none exist, seeds from role+profiles.permissions.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "Missing required query: userId" },
        { status: 400 }
      );
    }

    const supabase = adminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const { data: existing, error: grantsError } = await supabase
      .from("addbell_user_grants")
      .select("capability_key")
      .eq("user_id", userId);

    if (grantsError) {
      return NextResponse.json({ error: grantsError.message }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({
        userId,
        keys: existing.map((r) => r.capability_key as string).sort(),
        seeded: false,
      });
    }

    // Backfill from role + legacy permissions jsonb
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, permissions")
      .eq("id", userId)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const role = String(profile?.role || "viewer")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    const keys = userPermissionsToGrantKeys(
      mergePermissions(
        role,
        (profile?.permissions as Partial<UserPermissions> | null) ?? null
      )
    );

    if (keys.length > 0) {
      const rows = keys.map((capability_key) => ({
        user_id: userId,
        capability_key,
        granted_by: authUser.userId,
      }));
      const { error: insertError } = await supabase
        .from("addbell_user_grants")
        .upsert(rows, { onConflict: "user_id,capability_key" });
      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ userId, keys, seeded: true });
  } catch (err: unknown) {
    console.error("GET /api/access/grants:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load grants" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/access/grants
 * Body: { userId, keys: string[], role?: string }
 * Replaces all grants for the user. Optionally mirrors role pack label on profiles.role.
 */
export async function PUT(req: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      userId?: string;
      keys?: string[];
      role?: string;
    };
    const { userId, keys, role } = body;

    if (!userId || !Array.isArray(keys)) {
      return NextResponse.json(
        { error: "Missing required fields: userId, keys" },
        { status: 400 }
      );
    }

    const allowed = new Set(ACCESS_CAPABILITY_KEYS);
    const uniqueKeys = [...new Set(keys.filter((k) => allowed.has(k)))].sort();

    const supabase = adminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabase
      .from("addbell_user_grants")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (uniqueKeys.length > 0) {
      const rows = uniqueKeys.map((capability_key) => ({
        user_id: userId,
        capability_key,
        granted_by: authUser.userId,
      }));
      const { error: insertError } = await supabase
        .from("addbell_user_grants")
        .insert(rows);
      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    // Mirror into profiles.permissions for optional fallback / legacy tools
    const mirrored = grantsToUserPermissions(uniqueKeys);
    const profileUpdates: Record<string, unknown> = {
      permissions: mirrored,
      updated_at: new Date().toISOString(),
    };
    if (typeof role === "string" && role.trim()) {
      profileUpdates.role = role.trim().toLowerCase().replace(/\s+/g, "_");
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ userId, keys: uniqueKeys });
  } catch (err: unknown) {
    console.error("PUT /api/access/grants:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save grants" },
      { status: 500 }
    );
  }
}
