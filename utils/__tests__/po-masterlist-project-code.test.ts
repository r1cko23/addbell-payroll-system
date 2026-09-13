import { describe, expect, it } from "vitest";
import {
  nextProjectCodeFromPoNumber,
  projectDetailPoReference,
} from "@/lib/po-masterlist-project-code";

describe("project catalog code from P.O. number", () => {
  it("uses the P.O. number when that code is unused", () => {
    const used = new Set<string>();
    expect(nextProjectCodeFromPoNumber("TCP30008646-1", used)).toBe(
      "TCP30008646-1"
    );
    expect(used.has("TCP30008646-1")).toBe(true);
  });

  it("suffixes when the P.O. number is already a project code", () => {
    const used = new Set(["TCP30008646-1"]);
    expect(nextProjectCodeFromPoNumber("TCP30008646-1", used)).toBe(
      "TCP30008646-1-2"
    );
  });

  it("never generates an ML- hash code", () => {
    const used = new Set(["5695518"]);
    const code = nextProjectCodeFromPoNumber("5695518", used);
    expect(code).toBe("5695518-2");
    expect(code.startsWith("ML-")).toBe(false);
  });

  it("refuses to invent a catalog code without a P.O. number", () => {
    expect(() => nextProjectCodeFromPoNumber("  ", new Set())).toThrow(
      /P\.O\. number is required/
    );
  });

  it("shows unique linked P.O. numbers on the project detail subtitle", () => {
    expect(projectDetailPoReference([])).toBeNull();
    expect(
      projectDetailPoReference([{ po_number: "TCP30008646-1" }])
    ).toBe("TCP30008646-1");
    expect(
      projectDetailPoReference([
        { po_number: "5695518" },
        { po_number: "5695518" },
        { po_number: " 5695518 " },
      ])
    ).toBe("5695518");
    expect(
      projectDetailPoReference([
        { po_number: "5695518" },
        { po_number: "TCP30001606" },
      ])
    ).toBe("5695518 · TCP30001606");
  });
});
