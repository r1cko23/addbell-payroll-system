import { describe, expect, it } from "vitest";
import { withCurrentStatusOption } from "@/lib/po-masterlist-status-options";

const PROJECT_STATUS_OPTIONS = [
  "ON-GOING",
  "PENDING",
  "COMPLETED",
  "CANCELLED",
] as const;

const PAYMENT_STATUS_OPTIONS = [
  "PENDING",
  "PAID",
  "FOR INVOICE",
  "CANCELLED",
] as const;

describe("withCurrentStatusOption", () => {
  it("keeps the catalog when the current value is already listed", () => {
    expect(withCurrentStatusOption(PROJECT_STATUS_OPTIONS, "on-going")).toEqual([
      ...PROJECT_STATUS_OPTIONS,
    ]);
    expect(withCurrentStatusOption(PAYMENT_STATUS_OPTIONS, "PAID")).toEqual([
      ...PAYMENT_STATUS_OPTIONS,
    ]);
  });

  it("prepends an unknown saved value so the select can still show it", () => {
    expect(withCurrentStatusOption(PROJECT_STATUS_OPTIONS, "hold")).toEqual([
      "HOLD",
      ...PROJECT_STATUS_OPTIONS,
    ]);
    expect(withCurrentStatusOption(PAYMENT_STATUS_OPTIONS, "")).toEqual([
      ...PAYMENT_STATUS_OPTIONS,
    ]);
  });
});
