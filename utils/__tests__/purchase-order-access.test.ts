import { describe, expect, it } from "vitest";
import { getDefaultLandingRoute } from "@/lib/default-landing-route";
import { mergePermissions } from "@/lib/permissions";
import { canReadPurchaseOrderJobCatalog } from "@/lib/purchase-order-access";

/** Carizza Leonardo — operations_manager dashboard user */
const CARIZZA_LEONARDO_USER_ID = "4ed5c668-bef6-4373-8e9f-1af55ef10f09";
/** CRISTINA MALANGUEZ MARTE — employee record (Purchasing) */
const CRISTINA_MARTE_EMPLOYEE_ID = "c84e7a00-66ab-446f-99af-9d6b0207325c";
const JOEL_MALLARI_USER_ID = "bc93a339-6a61-45fe-98d8-b51bf16cd889";

describe("named purchase order page and create access", () => {
  it("lets Carizza Leonardo view and create purchase orders as operations manager", () => {
    const permissions = mergePermissions("operations_manager", null, {
      userId: CARIZZA_LEONARDO_USER_ID,
    });
    expect(permissions.purchase_orders.read).toBe(true);
    expect(permissions.purchase_orders.create).toBe(true);
  });

  it("does not let another operations manager create purchase orders", () => {
    const permissions = mergePermissions("operations_manager", null, {
      userId: JOEL_MALLARI_USER_ID,
    });
    expect(permissions.purchase_orders.read).toBe(true);
    expect(permissions.purchase_orders.create).toBe(false);
  });

  it("lets Cristina Malanguez Marte view and create purchase orders", () => {
    const permissions = mergePermissions("employee", null, {
      employeeId: CRISTINA_MARTE_EMPLOYEE_ID,
    });
    expect(permissions.purchase_orders.read).toBe(true);
    expect(permissions.purchase_orders.create).toBe(true);
  });

  it("lets Cristina view and create purchase orders by dashboard user id", () => {
    const permissions = mergePermissions("employee", null, {
      userId: "080b2cc3-e9f2-4d21-aa4e-324514c5be20",
    });
    expect(permissions.purchase_orders.read).toBe(true);
    expect(permissions.purchase_orders.create).toBe(true);
  });

  it("does not grant purchase orders when no named person matches", () => {
    const permissions = mergePermissions("employee", null, {
      userId: "00000000-0000-0000-0000-000000000000",
    });
    expect(permissions.purchase_orders.read).toBe(false);
    expect(permissions.purchase_orders.create).toBe(false);
  });

  it("lands Cristina on the purchase order page after dashboard login", () => {
    expect(
      getDefaultLandingRoute("employee", null, {
        employeeId: CRISTINA_MARTE_EMPLOYEE_ID,
      })
    ).toBe("/purchase-order");
  });

  it("lets Cristina read the job catalog used when creating a purchase order", () => {
    const permissions = mergePermissions("employee", null, {
      employeeId: CRISTINA_MARTE_EMPLOYEE_ID,
    });
    expect(canReadPurchaseOrderJobCatalog(permissions)).toBe(true);
  });
});
