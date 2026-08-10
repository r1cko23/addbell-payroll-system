import { describe, expect, it } from "vitest";
import { formatPhpCheckAmountInWords } from "@/utils/php-check-amount-words";

describe("formatPhpCheckAmountInWords", () => {
  it("formats the Constantino Milo sample total", () => {
    expect(formatPhpCheckAmountInWords(191_812.5)).toBe(
      "One Hundred Ninety-One Thousand Eight Hundred Twelve Pesos and 50/100 Centavos Only"
    );
  });

  it("zero-pads single-digit centavos as nn/100", () => {
    expect(formatPhpCheckAmountInWords(10.1)).toBe(
      "Ten Pesos and 10/100 Centavos Only"
    );
    expect(formatPhpCheckAmountInWords(25.05)).toBe(
      "Twenty-Five Pesos and 05/100 Centavos Only"
    );
  });

  it("handles whole pesos with 00/100", () => {
    expect(formatPhpCheckAmountInWords(1_000)).toBe(
      "One Thousand Pesos and 00/100 Centavos Only"
    );
  });

  it("handles zero", () => {
    expect(formatPhpCheckAmountInWords(0)).toBe(
      "Zero Pesos and 00/100 Centavos Only"
    );
  });

  it("uses two-decimal bank rounding for check cents", () => {
    expect(formatPhpCheckAmountInWords(1.994)).toBe(
      "One Pesos and 99/100 Centavos Only"
    );
    expect(formatPhpCheckAmountInWords(99.999)).toBe(
      "One Hundred Pesos and 00/100 Centavos Only"
    );
  });
});
