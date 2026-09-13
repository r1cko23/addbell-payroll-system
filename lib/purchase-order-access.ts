import type { UserPermissions } from "@/lib/permissions";

/** Carizza Leonardo — operations_manager dashboard user */
export const CARIZZA_LEONARDO_USER_ID = "4ed5c668-bef6-4373-8e9f-1af55ef10f09";

/** CRISTINA MALANGUEZ MARTE — employees.id (Purchasing / Assistant Project Support) */
export const CRISTINA_MARTE_EMPLOYEE_ID = "c84e7a00-66ab-446f-99af-9d6b0207325c";

/** Cristina Malanguez Marte — dashboard login linked to that employee */
export const CRISTINA_MARTE_USER_ID = "080b2cc3-e9f2-4d21-aa4e-324514c5be20";

const PURCHASE_ORDER_CREATOR_USER_IDS = new Set<string>([
  CARIZZA_LEONARDO_USER_ID,
  CRISTINA_MARTE_USER_ID,
]);

const PURCHASE_ORDER_CREATOR_EMPLOYEE_IDS = new Set<string>([
  CRISTINA_MARTE_EMPLOYEE_ID,
]);

export type PermissionActor = {
  userId?: string | null;
  employeeId?: string | null;
};

export function isNamedPurchaseOrderCreator(
  actor?: PermissionActor | null
): boolean {
  const userId = actor?.userId?.trim();
  if (userId && PURCHASE_ORDER_CREATOR_USER_IDS.has(userId)) return true;
  const employeeId = actor?.employeeId?.trim();
  if (employeeId && PURCHASE_ORDER_CREATOR_EMPLOYEE_IDS.has(employeeId)) {
    return true;
  }
  return false;
}

/** Overlay: open the Purchase Order page and create POs. Does not change role. */
export function applyNamedPurchaseOrderGrants(
  permissions: UserPermissions,
  actor?: PermissionActor | null
): UserPermissions {
  if (!isNamedPurchaseOrderCreator(actor)) return permissions;
  return {
    ...permissions,
    purchase_orders: {
      ...permissions.purchase_orders,
      create: true,
      read: true,
      update: true,
    },
  };
}

/** Job picker on New purchase order needs masterlist read. */
export function canReadPurchaseOrderJobCatalog(
  permissions: UserPermissions
): boolean {
  return permissions.projects.read || permissions.purchase_orders.read;
}
