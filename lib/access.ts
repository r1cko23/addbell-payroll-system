/**
 * Addbell ABAC catalog: Pages + Functions grants.
 * Role is a starter pack label only — grants are the source of truth.
 */

import {
  MODULE_INFO,
  MODULES,
  DEFAULT_PERMISSIONS,
  EMPTY_PERMISSIONS,
  type ModuleName,
  type UserPermissions,
  type ModulePermissions,
} from "@/lib/permissions";

export type CapabilityKind = "page" | "function";

export type AccessCategory =
  | "overview"
  | "people"
  | "operations"
  | "time"
  | "reports"
  | "settings";

export const ACCESS_CATEGORY_ORDER: AccessCategory[] = [
  "overview",
  "people",
  "operations",
  "time",
  "reports",
  "settings",
];

export const ACCESS_CATEGORY_LABELS: Record<AccessCategory, string> = {
  overview: "Overview",
  people: "People & Payroll",
  operations: "Operations",
  time: "Time & Attendance",
  reports: "Reports & Audit",
  settings: "Settings",
};

/** Map MODULE_INFO.category → ABAC UI category (splits admin into ops vs reports). */
function accessCategoryForModule(module: ModuleName): AccessCategory {
  const info = MODULE_INFO.find((m) => m.key === module);
  const raw = info?.category;
  if (raw === "overview") return "overview";
  if (raw === "people") return "people";
  if (raw === "time") return "time";
  if (raw === "settings") return "settings";
  // Split former "admin" bucket for easier assignment
  if (
    module === "audit" ||
    module === "bir_reports" ||
    module === "reports"
  ) {
    return "reports";
  }
  return "operations";
}

export type AccessCapability = {
  key: string;
  kind: CapabilityKind;
  label: string;
  description: string;
  sort_order: number;
  category: AccessCategory;
  /** Module this capability maps to (for CRUD bridge). */
  module: ModuleName;
  /** For functions: create | update | delete. Pages imply read. */
  action?: "create" | "update" | "delete";
};

export function pageKey(module: ModuleName): string {
  return `page:${module}`;
}

export function fnKey(
  module: ModuleName,
  action: "create" | "update" | "delete"
): string {
  return `fn:${module}.${action}`;
}

/** Full catalog derived from MODULE_INFO. */
export const ACCESS_CAPABILITIES: AccessCapability[] = (() => {
  const caps: AccessCapability[] = [];
  let sort = 0;
  for (const info of MODULE_INFO) {
    const category = accessCategoryForModule(info.key);
    caps.push({
      key: pageKey(info.key),
      kind: "page",
      label: info.label,
      description: info.description,
      sort_order: sort++,
      category,
      module: info.key,
    });
    for (const action of ["create", "update", "delete"] as const) {
      caps.push({
        key: fnKey(info.key, action),
        kind: "function",
        label: `${info.label} · ${action}`,
        description: `${action} on ${info.label}`,
        sort_order: sort++,
        category,
        module: info.key,
        action,
      });
    }
  }
  return caps;
})();

export const ACCESS_PAGE_CAPABILITIES = ACCESS_CAPABILITIES.filter(
  (c) => c.kind === "page"
);
export const ACCESS_FUNCTION_CAPABILITIES = ACCESS_CAPABILITIES.filter(
  (c) => c.kind === "function"
);

export const ACCESS_CAPABILITY_KEYS = ACCESS_CAPABILITIES.map((c) => c.key);

export const STARTER_PACK_IDS = Object.keys(DEFAULT_PERMISSIONS);

export function canPage(grants: Iterable<string>, moduleOrPageId: string): boolean {
  const key = moduleOrPageId.startsWith("page:")
    ? moduleOrPageId
    : pageKey(moduleOrPageId as ModuleName);
  return new Set(grants).has(key);
}

export function canFn(
  grants: Iterable<string>,
  moduleOrFnId: string,
  action?: "create" | "update" | "delete"
): boolean {
  const key =
    moduleOrFnId.startsWith("fn:")
      ? moduleOrFnId
      : action
        ? fnKey(moduleOrFnId as ModuleName, action)
        : moduleOrFnId;
  return new Set(grants).has(key);
}

/** Convert CRUD UserPermissions → grant keys (page + write fns). */
export function userPermissionsToGrantKeys(
  permissions: UserPermissions
): string[] {
  const keys: string[] = [];
  for (const module of Object.values(MODULES)) {
    const perms = permissions[module];
    if (!perms) continue;
    if (perms.read) keys.push(pageKey(module));
    if (perms.create) keys.push(fnKey(module, "create"));
    if (perms.update) keys.push(fnKey(module, "update"));
    if (perms.delete) keys.push(fnKey(module, "delete"));
  }
  return keys.sort();
}

/** Convert grant keys → CRUD UserPermissions for the legacy bridge. */
export function grantsToUserPermissions(
  grantKeys: Iterable<string>
): UserPermissions {
  const set = new Set(grantKeys);
  const result = structuredClone(EMPTY_PERMISSIONS) as UserPermissions;

  for (const module of Object.values(MODULES)) {
    const next: ModulePermissions = {
      create: set.has(fnKey(module, "create")),
      read: set.has(pageKey(module)),
      update: set.has(fnKey(module, "update")),
      delete: set.has(fnKey(module, "delete")),
    };
    // Write without page still implies read so existing UI doesn't soft-lock.
    if (next.create || next.update || next.delete) {
      next.read = true;
    }
    result[module] = next;
  }
  return result;
}

/** Starter pack grant keys for a role id. */
export function packGrantKeys(role: string): string[] {
  const normalized = role.trim().toLowerCase().replace(/\s+/g, "_");
  const pack = DEFAULT_PERMISSIONS[normalized];
  if (!pack) return [];
  return userPermissionsToGrantKeys(pack);
}

export function grantsMatchPack(
  grantKeys: Iterable<string>,
  role: string
): boolean {
  const a = [...new Set(grantKeys)].sort().join("\n");
  const b = packGrantKeys(role).join("\n");
  return a === b;
}

export function starterPackLabel(role: string): string {
  return role.trim().toLowerCase().replace(/\s+/g, "_") || "viewer";
}
