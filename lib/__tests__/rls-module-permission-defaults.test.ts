import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

const MIGRATION = path.resolve(
  __dirname,
  "../../supabase/migrations/20261107090000_rls_module_permission_helper_and_payroll_runs.sql"
);

function sqlDefaults(): Record<string, unknown> {
  const sql = readFileSync(MIGRATION, "utf8");
  const match = sql.match(/-- DEFAULTS:BEGIN\s*\$defaults\$([\s\S]*?)\$defaults\$\s*-- DEFAULTS:END/);
  if (!match) throw new Error("DEFAULTS markers not found in migration");
  return JSON.parse(match[1]);
}

describe("has_module_permission SQL defaults", () => {
  it("match DEFAULT_PERMISSIONS in lib/permissions.ts exactly", () => {
    expect(sqlDefaults()).toEqual(JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)));
  });
});
