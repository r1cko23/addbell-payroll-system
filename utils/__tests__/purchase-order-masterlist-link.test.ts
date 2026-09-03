import { describe, expect, it } from "vitest";
import {
  isStrongPoNumberDigitCore,
  isStrongPoNumberKey,
  masterlistLinkLabel,
  normalizePoNumberKey,
  poNumberDigitCore,
} from "@/lib/purchase-order-masterlist-link";

describe("normalizePoNumberKey", () => {
  it("strips PO prefixes, spaces, and punctuation", () => {
    expect(normalizePoNumberKey("PO-RE1350007312")).toBe("RE1350007312");
    expect(normalizePoNumberKey("PO#153220")).toBe("153220");
    expect(normalizePoNumberKey("PO- RE135000769")).toBe("RE135000769");
    expect(normalizePoNumberKey("P00000004293")).toBe("P00000004293");
  });

  it("strips letter wrappers like TCP in front of digits", () => {
    expect(normalizePoNumberKey("TCP30012515-1")).toBe("300125151");
    expect(normalizePoNumberKey("30012515-1")).toBe("300125151");
    expect(normalizePoNumberKey("RSC-PO0130277846")).toBe("0130277846");
  });

  it("treats weak placeholders as short keys", () => {
    expect(normalizePoNumberKey("1")).toBe("1");
    expect(normalizePoNumberKey("No PO, with NTP")).toBe("NOPOWITHNTP");
    expect(isStrongPoNumberKey(normalizePoNumberKey("1"))).toBe(false);
    expect(isStrongPoNumberKey(normalizePoNumberKey("RE1350007312"))).toBe(true);
  });
});

describe("poNumberDigitCore", () => {
  it("matches leading-zero variants", () => {
    expect(poNumberDigitCore("PO000010311")).toBe("10311");
    expect(poNumberDigitCore("PO0000010311")).toBe("10311");
    expect(isStrongPoNumberDigitCore(poNumberDigitCore("PO000010311"))).toBe(true);
    expect(isStrongPoNumberDigitCore(poNumberDigitCore("TCP30012515-1"))).toBe(true);
  });
});

describe("masterlistLinkLabel", () => {
  it("labels statuses for UI", () => {
    expect(masterlistLinkLabel("linked")).toBe("Masterlist linked");
    expect(masterlistLinkLabel("needs_review")).toBe("Needs purchasing update");
    expect(masterlistLinkLabel(null)).toBe("Unreviewed");
  });
});
