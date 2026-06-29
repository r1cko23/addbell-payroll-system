import {
  formatTinWithDashes,
  stripTinDigits,
  TIN_MAX_DIGITS,
} from "@/lib/tin-format";

describe("formatTinWithDashes", () => {
  test("formats partial input while typing", () => {
    expect(formatTinWithDashes("123")).toBe("123");
    expect(formatTinWithDashes("1234")).toBe("123-4");
    expect(formatTinWithDashes("123456789")).toBe("123-456-789");
    expect(formatTinWithDashes("123456789012345")).toBe("123-456-789-012345");
  });

  test("strips non-digits and caps length", () => {
    expect(stripTinDigits("123-456-789-012345")).toBe("123456789012345");
    expect(stripTinDigits("1a2b3c")).toBe("123");
    expect(stripTinDigits("1".repeat(20)).length).toBe(TIN_MAX_DIGITS);
  });

  test("reformats stored values without dashes", () => {
    expect(formatTinWithDashes("123456789012345")).toBe("123-456-789-012345");
  });
});
