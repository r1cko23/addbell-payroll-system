import { describe, expect, it } from "vitest";
import {
  assignSequentialClientPoCodes,
  formatClientPoCode,
  nextClientPoCode,
} from "@/lib/client-po-code";

describe("client PO codes", () => {
  it("pads one- and two-digit codes from 01, then uses unpadded 100+", () => {
    expect(formatClientPoCode(1)).toBe("01");
    expect(formatClientPoCode(9)).toBe("09");
    expect(formatClientPoCode(10)).toBe("10");
    expect(formatClientPoCode(99)).toBe("99");
    expect(formatClientPoCode(100)).toBe("100");
  });

  it("assigns 01 to a single client and sequential codes to many, sorted by name", () => {
    expect(assignSequentialClientPoCodes([])).toEqual([]);
    expect(
      assignSequentialClientPoCodes([{ id: "a", name: "Zebra Co" }])
    ).toEqual([{ id: "a", clientPoCode: "01" }]);
    expect(
      assignSequentialClientPoCodes([
        { id: "z", name: "Zebra Co" },
        { id: "a", name: "Acme Inc" },
        { id: "m", name: "Metro Labs" },
      ])
    ).toEqual([
      { id: "a", clientPoCode: "01" },
      { id: "m", clientPoCode: "02" },
      { id: "z", clientPoCode: "03" },
    ]);
  });

  it("picks the next unused numeric code, filling a gap, and ignores letter codes", () => {
    expect(nextClientPoCode(new Set())).toBe("01");
    expect(nextClientPoCode(new Set(["PUC", "AEI"]))).toBe("01");
    expect(nextClientPoCode(new Set(["01", "03"]))).toBe("02");
    expect(nextClientPoCode(new Set(["01", "02"]))).toBe("03");
  });
});
