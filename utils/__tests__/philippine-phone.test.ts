import {
  formatPhilippinePhoneForInput,
  normalizePhilippinePhone,
  normalizePhilippinePhoneInput,
} from "@/lib/philippine-phone";

describe("normalizePhilippinePhone", () => {
  test("converts +63 mobile paste to local 09… format", () => {
    expect(normalizePhilippinePhone("639171161116")).toBe("09171161116");
    expect(normalizePhilippinePhone("+63 917 116 1116")).toBe("09171161116");
    expect(normalizePhilippinePhone("63-917-116-1116")).toBe("09171161116");
  });

  test("leaves local numbers unchanged", () => {
    expect(normalizePhilippinePhone("09171161116")).toBe("09171161116");
  });

  test("does not convert short partial 63 prefix while typing", () => {
    expect(normalizePhilippinePhone("63917")).toBe("63917");
  });
});

describe("normalizePhilippinePhoneInput", () => {
  test("caps normalized local numbers at 11 digits", () => {
    expect(normalizePhilippinePhoneInput("639171161116")).toBe("09171161116");
  });
});

describe("formatPhilippinePhoneForInput", () => {
  test("formats +63 and 63 mobile pastes with spaces", () => {
    expect(formatPhilippinePhoneForInput("+63 917 555-0123")).toBe("0917 555 0123");
    expect(formatPhilippinePhoneForInput("63 917 555-0123")).toBe("0917 555 0123");
    expect(formatPhilippinePhoneForInput("09175550123")).toBe("0917 555 0123");
  });

  test("formats partial mobile while typing", () => {
    expect(formatPhilippinePhoneForInput("0917555")).toBe("0917 555");
  });
});
