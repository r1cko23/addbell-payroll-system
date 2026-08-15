import { describe, expect, it } from "vitest";
import {
  ADDBELL_CHECK_ACCOUNT_NAME,
  applyCheckPrintOffset,
  buildCheckPrintContent,
  CHECK_DATE_DIGIT_LAYOUT,
  CHECK_PRINT_PAGE_HEIGHT_MM,
  CHECK_PRINT_PAGE_WIDTH_MM,
  CHECK_PRINT_RIGHT_SLACK_MM,
  CHECK_PRINT_STOCK_HEIGHT_MM,
  CHECK_TEMPLATES,
  getDefaultCheckPrintOffset,
  formatCheckAmountFigures,
  formatCheckAmountInWordsPrint,
  formatCheckDate,
  formatCheckPayee,
  getCheckDateDigits,
  getCheckSignatureBoxCount,
} from "@/utils/php-check-print";

describe("formatCheckDate", () => {
  it("formats as MM-DD-YYYY", () => {
    expect(formatCheckDate(new Date(2026, 7, 10))).toBe("08-10-2026");
  });
});

describe("formatCheckAmountFigures", () => {
  it("uses commas and period without peso sign", () => {
    expect(formatCheckAmountFigures(131_247.59)).toBe("131,247.59");
  });
});

describe("formatCheckPayee", () => {
  it("uppercases without asterisk padding", () => {
    expect(formatCheckPayee("  Aleja Blower Corporation  ")).toBe(
      "ALEJA BLOWER CORPORATION"
    );
  });
});

describe("formatCheckAmountInWordsPrint", () => {
  it("matches official filled ALL CAPS style", () => {
    expect(formatCheckAmountInWordsPrint(37_125)).toBe(
      "THIRTY SEVEN THOUSAND ONE HUNDRED TWENTY FIVE PESOS ONLY"
    );
    expect(formatCheckAmountInWordsPrint(34_390.18)).toBe(
      "THIRTY FOUR THOUSAND THREE HUNDRED NINETY PESOS & 18/100 CENTAVOS ONLY"
    );
  });
});

describe("getCheckSignatureBoxCount", () => {
  it("uses two boxes for corporate stock", () => {
    expect(getCheckSignatureBoxCount("bdo")).toBe(2);
    expect(getCheckSignatureBoxCount("bpi")).toBe(2);
  });
});

describe("getCheckDateDigits", () => {
  it("extracts 8 boxed digits from MM-DD-YYYY", () => {
    expect(getCheckDateDigits("08-10-2026")).toEqual([
      "0",
      "8",
      "1",
      "0",
      "2",
      "0",
      "2",
      "6",
    ]);
  });
});

describe("CHECK_TEMPLATES payee line", () => {
  it("starts on the left at the pesos-in-words size and stops before ₱", () => {
    const { payee, amountWords, amountFigures } = CHECK_TEMPLATES.bdo;
    expect(payee.textAlign).toBe("left");
    expect(payee.fontSizePt).toBe(amountWords.fontSizePt);
    expect(payee.leftMm).toBe(amountWords.leftMm);
    expect(payee.leftMm + payee.widthMm).toBeLessThan(amountFigures.leftMm - 10);
  });
});

describe("CHECK_DATE_DIGIT_LAYOUT", () => {
  it("uses eight centered digit slots for BDO and BPI", () => {
    expect(CHECK_DATE_DIGIT_LAYOUT.bdo.slots).toHaveLength(8);
    expect(CHECK_DATE_DIGIT_LAYOUT.bpi.slots).toHaveLength(8);
  });
});

describe("ADDBELL_CHECK_ACCOUNT_NAME", () => {
  it("matches Addbell check stock account name", () => {
    expect(ADDBELL_CHECK_ACCOUNT_NAME).toBe("ADD-BELL TECHNICAL SERVICES INC");
  });
});

describe("buildCheckPrintContent", () => {
  it("assembles official BDO/BPI text fields", () => {
    const content = buildCheckPrintContent({
      bank: "bdo",
      payee: "Aleja Blower Corporation",
      amount: 131_247.59,
      date: new Date(2026, 7, 10),
    });
    expect(content.date).toBe("08-10-2026");
    expect(content.amountFigures).toBe("131,247.59");
    expect(content.payee).toBe("ALEJA BLOWER CORPORATION");
    expect(content.amountWords).toBe(
      "ONE HUNDRED THIRTY ONE THOUSAND TWO HUNDRED FORTY SEVEN PESOS & 59/100 CENTAVOS ONLY"
    );
  });
});

describe("getDefaultCheckPrintOffset", () => {
  it("uses the measured Addbell Epson feed (X -1.5, Y 8.0)", () => {
    expect(getDefaultCheckPrintOffset()).toEqual({
      offsetXMm: -1.5,
      offsetYMm: 8.0,
    });
  });
});

describe("CHECK_PRINT_PAGE size", () => {
  it("matches cheque length × L565 9 cm minimum feed width", () => {
    expect(CHECK_PRINT_PAGE_WIDTH_MM).toBe(203.2);
    expect(CHECK_PRINT_PAGE_HEIGHT_MM).toBe(90);
  });

  it("leaves the 9 cm right-side slack unused (clipper-aligned, not centered)", () => {
    expect(CHECK_PRINT_STOCK_HEIGHT_MM).toBe(76.8);
    expect(CHECK_PRINT_RIGHT_SLACK_MM).toBeCloseTo(13.2, 1);
    expect(CHECK_PRINT_STOCK_HEIGHT_MM + CHECK_PRINT_RIGHT_SLACK_MM).toBe(
      CHECK_PRINT_PAGE_HEIGHT_MM
    );
  });
});

describe("applyCheckPrintOffset", () => {
  it("shifts all field boxes by mm offsets", () => {
    const shifted = applyCheckPrintOffset(CHECK_TEMPLATES.bpi, {
      offsetXMm: 1.5,
      offsetYMm: -0.5,
    });
    expect(shifted.date.leftMm).toBe(CHECK_TEMPLATES.bpi.date.leftMm + 1.5);
    expect(shifted.date.topMm).toBe(CHECK_TEMPLATES.bpi.date.topMm - 0.5);
  });
});
