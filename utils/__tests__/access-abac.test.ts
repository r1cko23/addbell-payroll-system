import { describe, expect, it } from "vitest";
import {
  grantsMatchPack,
  grantsToUserPermissions,
  packGrantKeys,
  pageKey,
  fnKey,
  userPermissionsToGrantKeys,
} from "@/lib/access";
import { mergePermissions } from "@/lib/permissions";

describe("ABAC access catalog bridge", () => {
  it("builds admin pack with all pages and write functions", () => {
    const keys = packGrantKeys("admin");
    expect(keys).toContain(pageKey("dashboard"));
    expect(keys).toContain(pageKey("user_management"));
    expect(keys).toContain(fnKey("employees", "create"));
    expect(keys).toContain(fnKey("purchase_orders", "delete"));
    expect(keys.length).toBeGreaterThan(40);
  });

  it("builds operations_manager pack without user_management page", () => {
    const keys = new Set(packGrantKeys("operations_manager"));
    expect(keys.has(pageKey("fund_requests"))).toBe(true);
    expect(keys.has(pageKey("projects"))).toBe(true);
    expect(keys.has(pageKey("user_management"))).toBe(false);
  });

  it("builds purchasing_officer pack with internal PO write fns", () => {
    const keys = new Set(packGrantKeys("purchasing_officer"));
    expect(keys.has(pageKey("purchase_orders"))).toBe(true);
    expect(keys.has(fnKey("purchase_orders", "create"))).toBe(true);
    expect(keys.has(fnKey("purchase_orders", "update"))).toBe(true);
    expect(keys.has(pageKey("vendors"))).toBe(true);
  });

  it("round-trips grants ↔ UserPermissions for OM pack", () => {
    const original = packGrantKeys("operations_manager");
    const perms = grantsToUserPermissions(original);
    const roundTrip = userPermissionsToGrantKeys(perms);
    expect(roundTrip).toEqual(original);
    expect(grantsMatchPack(roundTrip, "operations_manager")).toBe(true);
  });

  it("round-trips grants ↔ UserPermissions for purchasing pack", () => {
    const original = packGrantKeys("purchasing_officer");
    const perms = grantsToUserPermissions(original);
    expect(perms.purchase_orders.create).toBe(true);
    expect(perms.purchase_orders.read).toBe(true);
    expect(userPermissionsToGrantKeys(perms)).toEqual(original);
  });

  it("round-trips grants ↔ UserPermissions for admin pack", () => {
    const original = packGrantKeys("admin");
    const perms = grantsToUserPermissions(original);
    expect(perms.user_management.read).toBe(true);
    expect(userPermissionsToGrantKeys(perms)).toEqual(original);
  });

  it("maps page grant to read and fn grants to write flags", () => {
    const perms = grantsToUserPermissions([
      pageKey("clients"),
      fnKey("clients", "update"),
    ]);
    expect(perms.clients).toEqual({
      create: false,
      read: true,
      update: true,
      delete: false,
    });
  });

  it("implies read when write fn exists without page grant", () => {
    const perms = grantsToUserPermissions([fnKey("vendors", "create")]);
    expect(perms.vendors.read).toBe(true);
    expect(perms.vendors.create).toBe(true);
  });

  it("converts mergePermissions(role, custom) into grant keys", () => {
    const merged = mergePermissions("hr", {
      payslips: { read: true, create: true, update: true, delete: true },
    });
    const keys = new Set(userPermissionsToGrantKeys(merged));
    expect(keys.has(pageKey("payslips"))).toBe(true);
    expect(keys.has(fnKey("payslips", "create"))).toBe(true);
    expect(keys.has(pageKey("user_management"))).toBe(false);
  });

  it("detects custom grants vs starter pack", () => {
    const pack = packGrantKeys("operations_manager");
    expect(grantsMatchPack(pack, "operations_manager")).toBe(true);
    expect(
      grantsMatchPack([...pack, pageKey("user_management")], "operations_manager")
    ).toBe(false);
  });
});
