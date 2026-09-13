/**
 * Role → editable column ACL for po_masterlist_jobs.
 * Module `projects.update` gates API access; this ACL gates fields.
 */

import { normalizeUserRole } from "@/lib/user-roles";

export const PO_MASTERLIST_EDITABLE_COLUMNS = [
  "po_date",
  "po_received_date",
  "po_number",
  "po_amount",
  "project_title",
  "client_name",
  "location",
  "payment_terms",
  "cari",
  "cari_expiry",
  "project_status",
  "payment_status",
  "invoice_numbers",
  "general_remarks",
] as const;

export type PoMasterlistEditableColumn =
  (typeof PO_MASTERLIST_EDITABLE_COLUMNS)[number];

const PURCHASING_BAND: PoMasterlistEditableColumn[] = [
  "po_date",
  "po_received_date",
  "po_number",
  "po_amount",
  "project_title",
  "client_name",
  "location",
  "payment_terms",
  "cari",
  "cari_expiry",
];

/** PO date → location (identity fields PMs maintain on the masterlist). */
const PM_IDENTITY_BAND: PoMasterlistEditableColumn[] = [
  "po_date",
  "po_received_date",
  "po_number",
  "po_amount",
  "project_title",
  "client_name",
  "location",
];

const PROJECT_STATUS_BAND: PoMasterlistEditableColumn[] = ["project_status"];

const BILLING_BAND: PoMasterlistEditableColumn[] = [
  "payment_status",
  "invoice_numbers",
];

const REMARKS_BAND: PoMasterlistEditableColumn[] = ["general_remarks"];

const ROLE_EDITABLE_COLUMNS: Record<string, ReadonlySet<PoMasterlistEditableColumn>> =
  {
    admin: new Set(PO_MASTERLIST_EDITABLE_COLUMNS),
    // OM: ops fields + status/remarks. Payment status / invoice = UM (+ admin) only.
    operations_manager: new Set([
      ...PURCHASING_BAND,
      ...PROJECT_STATUS_BAND,
      ...REMARKS_BAND,
    ]),
    purchasing_officer: new Set(PURCHASING_BAND),
    // PMs: identity through location + project status. Payment/invoice remain visible, not editable.
    project_manager: new Set([...PM_IDENTITY_BAND, ...PROJECT_STATUS_BAND]),
    upper_management: new Set([...BILLING_BAND, ...REMARKS_BAND]),
  };

export function isPoMasterlistEditableColumn(
  field: string
): field is PoMasterlistEditableColumn {
  return (PO_MASTERLIST_EDITABLE_COLUMNS as readonly string[]).includes(field);
}

export function getEditablePoMasterlistColumnsForRole(
  role: string | null | undefined
): PoMasterlistEditableColumn[] {
  const normalized = normalizeUserRole(role);
  const set = ROLE_EDITABLE_COLUMNS[normalized];
  if (!set) return [];
  return PO_MASTERLIST_EDITABLE_COLUMNS.filter((column) => set.has(column));
}

export function canEditPoMasterlistColumn(
  role: string | null | undefined,
  field: string
): boolean {
  if (!isPoMasterlistEditableColumn(field)) return false;
  const normalized = normalizeUserRole(role);
  return ROLE_EDITABLE_COLUMNS[normalized]?.has(field) ?? false;
}

export function canCreatePoMasterlistJob(
  role: string | null | undefined
): boolean {
  const normalized = normalizeUserRole(role);
  return (
    normalized === "admin" ||
    normalized === "operations_manager" ||
    normalized === "purchasing_officer"
  );
}

/**
 * Partition a PATCH body into allowed updates vs forbidden/unknown fields.
 * Forbidden fields cause a hard 403 (do not silently drop).
 */
export function partitionPoMasterlistPatchFields(
  role: string | null | undefined,
  body: Record<string, unknown>
): {
  allowed: Partial<Record<PoMasterlistEditableColumn, unknown>>;
  forbidden: string[];
  unknown: string[];
} {
  const allowed: Partial<Record<PoMasterlistEditableColumn, unknown>> = {};
  const forbidden: string[] = [];
  const unknown: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (!isPoMasterlistEditableColumn(key)) {
      unknown.push(key);
      continue;
    }
    if (!canEditPoMasterlistColumn(role, key)) {
      forbidden.push(key);
      continue;
    }
    allowed[key] = value;
  }

  return { allowed, forbidden, unknown };
}
