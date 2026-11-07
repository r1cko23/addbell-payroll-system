import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");
const DEFAULTS_RE = /-- DEFAULTS:BEGIN\s*\$defaults\$([\s\S]*?)\$defaults\$\s*-- DEFAULTS:END/;

// The newest migration that (re)defines has_module_permission is what production runs.
function latestDefaultsMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => DEFAULTS_RE.test(readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")));
  if (files.length === 0) throw new Error("No migration defines has_module_permission defaults");
  return path.join(MIGRATIONS_DIR, files[files.length - 1]);
}

function sqlDefaults(): Record<string, unknown> {
  const match = readFileSync(latestDefaultsMigration(), "utf8").match(DEFAULTS_RE);
  if (!match) throw new Error("DEFAULTS markers not found in migration");
  return JSON.parse(match[1]);
}

describe("has_module_permission SQL defaults", () => {
  it("match DEFAULT_PERMISSIONS in lib/permissions.ts exactly", () => {
    expect(sqlDefaults()).toEqual(JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)));
  });
});

describe("permission helper migrations", () => {
  it("newest helper migration keeps staff_can as a wrapper so there is one copy of the defaults", () => {
    const sql = readFileSync(latestDefaultsMigration(), "utf8");
    expect(sql).toMatch(/create or replace function public\.staff_can[\s\S]*?select public\.has_module_permission\(p_module, p_action\)/);
    expect(sql).toMatch(/p\.is_active is true/);
  });
});
