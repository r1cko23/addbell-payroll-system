import { describe, expect, it } from "vitest";
import {
  canCreatePoMasterlistJob,
  canEditPoMasterlistColumn,
  getEditablePoMasterlistColumnsForRole,
  partitionPoMasterlistPatchFields,
} from "@/lib/po-masterlist-column-acl";

describe("po masterlist column ACL", () => {
  it("lets purchasing edit identity columns but not payment status", () => {
    expect(canEditPoMasterlistColumn("purchasing_officer", "po_number")).toBe(
      true
    );
    expect(
      canEditPoMasterlistColumn("purchasing_officer", "payment_status")
    ).toBe(false);
    expect(canCreatePoMasterlistJob("purchasing_officer")).toBe(true);
  });

  it("lets project managers edit PO date through location and project status", () => {
    const cols = getEditablePoMasterlistColumnsForRole("project_manager");
    expect(cols).toEqual([
      "po_date",
      "po_received_date",
      "po_number",
      "po_amount",
      "project_title",
      "client_name",
      "location",
      "project_status",
    ]);
    expect(canEditPoMasterlistColumn("project_manager", "po_amount")).toBe(
      true
    );
    expect(canEditPoMasterlistColumn("project_manager", "payment_status")).toBe(
      false
    );
    expect(
      canEditPoMasterlistColumn("project_manager", "invoice_numbers")
    ).toBe(false);
    expect(
      canEditPoMasterlistColumn("project_manager", "general_remarks")
    ).toBe(false);
  });

  it("lets upper management edit billing columns", () => {
    expect(canEditPoMasterlistColumn("upper_management", "invoice_numbers")).toBe(
      true
    );
    expect(canEditPoMasterlistColumn("upper_management", "po_number")).toBe(
      false
    );
  });

  it("lets operations managers edit ops fields but not payment/invoice", () => {
    const cols = getEditablePoMasterlistColumnsForRole("operations_manager");
    expect(cols).toContain("po_number");
    expect(cols).toContain("project_status");
    expect(cols).toContain("general_remarks");
    expect(cols).not.toContain("payment_status");
    expect(cols).not.toContain("invoice_numbers");
    expect(canEditPoMasterlistColumn("operations_manager", "payment_status")).toBe(
      false
    );
    expect(
      canEditPoMasterlistColumn("operations_manager", "invoice_numbers")
    ).toBe(false);
    expect(canCreatePoMasterlistJob("operations_manager")).toBe(true);
  });

  it("returns forbidden fields instead of silently dropping them", () => {
    const result = partitionPoMasterlistPatchFields("project_manager", {
      project_status: "COMPLETED",
      po_number: "X",
      payment_status: "PAID",
      unknown_field: 1,
    });
    expect(result.allowed).toEqual({
      project_status: "COMPLETED",
      po_number: "X",
    });
    expect(result.forbidden).toEqual(["payment_status"]);
    expect(result.unknown).toEqual(["unknown_field"]);
  });

  it("enqueues writeback only after an allowed patch, never a forbidden column", () => {
    const allowed = partitionPoMasterlistPatchFields("admin", {
      invoice_numbers: "440 (30%) - PAID",
    });
    expect(Object.keys(allowed.allowed)).toEqual(["invoice_numbers"]);
    expect(allowed.forbidden).toEqual([]);

    const blocked = partitionPoMasterlistPatchFields("project_manager", {
      invoice_numbers: "440 (30%) - PAID",
    });
    expect(blocked.allowed).toEqual({});
    expect(blocked.forbidden).toEqual(["invoice_numbers"]);
  });

  it("gives admin all columns; OM excludes billing", () => {
    expect(getEditablePoMasterlistColumnsForRole("admin")).toHaveLength(14);
    expect(
      getEditablePoMasterlistColumnsForRole("operations_manager")
    ).toHaveLength(12);
  });
});
