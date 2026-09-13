import { describe, expect, it } from "vitest";
import { nextInternalPoNumber } from "@/lib/internal-po-number";

describe("internal PO number generation", () => {
  const sept2026 = new Date(2026, 8, 13);
  const oct2026 = new Date(2026, 9, 1);

  it("uses ADDPO-YYMM-clientcode plus a month sequence that continues across clients", () => {
    const first = nextInternalPoNumber({
      issuedAt: sept2026,
      clientPoCode: "01",
      existingPoNumbers: [],
    });
    expect(first).toBe("ADDPO-2609-0101");

    const second = nextInternalPoNumber({
      issuedAt: sept2026,
      clientPoCode: "04",
      existingPoNumbers: [first],
    });
    expect(second).toBe("ADDPO-2609-0402");

    const third = nextInternalPoNumber({
      issuedAt: sept2026,
      clientPoCode: "11",
      existingPoNumbers: [first, second],
    });
    expect(third).toBe("ADDPO-2609-1103");
  });

  it("starts at 01 when there are no POs yet, and continues after a single saved PO", () => {
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "01",
        existingPoNumbers: [],
      })
    ).toBe("ADDPO-2609-0101");
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "01",
        existingPoNumbers: ["ADDPO-2609-0101"],
      })
    ).toBe("ADDPO-2609-0102");
  });

  it("resets the sequence in a new month and ignores other months and old formats", () => {
    expect(
      nextInternalPoNumber({
        issuedAt: oct2026,
        clientPoCode: "01",
        existingPoNumbers: [
          "ADDPO-2609-1103",
          "PROJ-VEND-2026-0001",
          "TCP30001606",
        ],
      })
    ).toBe("ADDPO-2610-0101");
  });

  it("keeps letter client codes and still appends the monthly sequence", () => {
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "AEI",
        existingPoNumbers: ["ADDPO-2609-0101"],
      })
    ).toBe("ADDPO-2609-AEI02");
  });

  it("pads 09 then 10, and uses three digits after 99 in the same month", () => {
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "01",
        existingPoNumbers: ["ADDPO-2609-0408"],
      })
    ).toBe("ADDPO-2609-0109");
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "01",
        existingPoNumbers: ["ADDPO-2609-0109"],
      })
    ).toBe("ADDPO-2609-0110");
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "01",
        existingPoNumbers: ["ADDPO-2609-0499"],
      })
    ).toBe("ADDPO-2609-01100");
  });

  it("takes the highest month sequence even when saved numbers are out of order", () => {
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "11",
        existingPoNumbers: ["ADDPO-2609-1103", "ADDPO-2609-0101", "ADDPO-2609-0402"],
      })
    ).toBe("ADDPO-2609-1104");
  });

  it("keeps a three-digit client code and still uses a two-digit month sequence", () => {
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "100",
        existingPoNumbers: [],
      })
    ).toBe("ADDPO-2609-10001");
  });

  it("counts mixed-case saved numbers and rejects a blank client PO code", () => {
    expect(
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: " 04 ",
        existingPoNumbers: ["addpo-2609-0101"],
      })
    ).toBe("ADDPO-2609-0402");
    expect(() =>
      nextInternalPoNumber({
        issuedAt: sept2026,
        clientPoCode: "   ",
        existingPoNumbers: [],
      })
    ).toThrow("Client PO code is required");
  });
});
