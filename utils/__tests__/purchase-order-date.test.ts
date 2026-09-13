import { describe, expect, it } from "vitest";
import {
  formatPoDateText,
  parsePoDateText,
  poDateTextToYmd,
  ymdToPoDateText,
} from "@/lib/purchase-order-date";

describe("purchase order date", () => {
  it("formats and parses the printed PO date, including a calendar yyyy-MM-dd pick", () => {
    expect(formatPoDateText(new Date(2026, 8, 13))).toBe("Sep. 13, 2026");
    expect(ymdToPoDateText("2026-10-01")).toBe("Oct. 1, 2026");
    expect(poDateTextToYmd("Sep. 13, 2026")).toBe("2026-09-13");
    expect(poDateTextToYmd("Oct. 1, 2026")).toBe("2026-10-01");
    expect(poDateTextToYmd("2026-09-13")).toBe("2026-09-13");
  });

  it("accepts a typed date without the month period, and treats blank or junk as empty", () => {
    expect(poDateTextToYmd("Sep 13, 2026")).toBe("2026-09-13");
    expect(poDateTextToYmd("")).toBe("");
    expect(poDateTextToYmd("   ")).toBe("");
    expect(poDateTextToYmd("not a date")).toBe("");
    expect(parsePoDateText("")).toBeNull();
    expect(parsePoDateText("n/a")).toBeNull();
  });
});
