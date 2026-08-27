/**
 * One-time seed: insert addbell_user_grants from mergePermissions(role, profiles.permissions).
 * Usage: npx tsx scripts/seed-addbell-user-grants.ts
 * Prints SQL; pipe or copy into supabase SQL editor / MCP execute_sql.
 */

import { createClient } from "@supabase/supabase-js";
import { mergePermissions, type UserPermissions } from "../lib/permissions";
import { userPermissionsToGrantKeys } from "../lib/access";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, role, permissions")
    .not("role", "is", null);

  if (error) throw error;

  const rows: { user_id: string; capability_key: string }[] = [];
  for (const profile of profiles ?? []) {
    const role = String(profile.role || "viewer")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    // Skip pure employee portal roles with no dashboard pack
    if (role === "employee" || role === "") continue;

    const keys = userPermissionsToGrantKeys(
      mergePermissions(
        role,
        (profile.permissions as Partial<UserPermissions> | null) ?? null
      )
    );
    for (const capability_key of keys) {
      rows.push({ user_id: profile.id, capability_key });
    }
  }

  if (rows.length === 0) {
    console.log("-- no grants to seed");
    return;
  }

  // Upsert via supabase client
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error: upsertError } = await supabase
      .from("addbell_user_grants")
      .upsert(slice, { onConflict: "user_id,capability_key" });
    if (upsertError) throw upsertError;
  }

  console.log(`Seeded ${rows.length} grant rows for ${new Set(rows.map((r) => r.user_id)).size} users`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
