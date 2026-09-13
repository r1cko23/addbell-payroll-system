import { describe, expect, it } from "vitest";
import {
  poMasterlistStatusBadgeClass,
  poMasterlistStatusTone,
} from "@/lib/po-masterlist-status-badge";

describe("PO masterlist status colors", () => {
  it("uses the same sheet palette for project status and payment status", () => {
    expect(poMasterlistStatusTone("COMPLETED")).toBe("success");
    expect(poMasterlistStatusTone("PAID")).toBe("success");
    expect(poMasterlistStatusBadgeClass("PAID")).toBe(
      poMasterlistStatusBadgeClass("COMPLETED")
    );

    expect(poMasterlistStatusTone("ON-GOING")).toBe("progress");
    expect(poMasterlistStatusTone("FOR INVOICE")).toBe("progress");
    expect(poMasterlistStatusBadgeClass("FOR INVOICE")).toBe(
      poMasterlistStatusBadgeClass("ON-GOING")
    );

    expect(poMasterlistStatusTone("PENDING")).toBe("pending");
    expect(poMasterlistStatusBadgeClass("PENDING")).toContain("yellow");

    expect(poMasterlistStatusTone("CANCELLED")).toBe("cancelled");
    expect(poMasterlistStatusBadgeClass("CANCELLED")).toContain("red");
  });

  it("keeps success, progress, pending, and cancelled visually distinct", () => {
    const success = poMasterlistStatusBadgeClass("COMPLETED");
    const progress = poMasterlistStatusBadgeClass("ON-GOING");
    const pending = poMasterlistStatusBadgeClass("PENDING");
    const cancelled = poMasterlistStatusBadgeClass("CANCELLED");

    expect(success).toContain("emerald");
    expect(progress).toContain("orange");
    expect(new Set([success, progress, pending, cancelled]).size).toBe(4);
  });

  it("treats empty and unknown statuses as neutral, and aliases as the sheet values", () => {
    expect(poMasterlistStatusTone(null)).toBe("neutral");
    expect(poMasterlistStatusTone("")).toBe("neutral");
    expect(poMasterlistStatusTone("N/A")).toBe("neutral");
    expect(poMasterlistStatusTone("HOLD")).toBe("neutral");

    expect(poMasterlistStatusTone("ongoing")).toBe("progress");
    expect(poMasterlistStatusTone("ON GOING")).toBe("progress");
    expect(poMasterlistStatusTone("complete")).toBe("success");
    expect(poMasterlistStatusTone("canceled")).toBe("cancelled");
    expect(poMasterlistStatusTone(" for invoice ")).toBe("progress");
  });
});
