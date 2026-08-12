import {
  applyCheckPrintOffset,
  buildCheckPrintContent,
  CHECK_DATE_DIGIT_LAYOUT,
  CHECK_PRINT_PAGE_HEIGHT_MM,
  CHECK_PRINT_PAGE_WIDTH_MM,
  CHECK_PRINT_TOP_INSET_MM,
  CHECK_TEMPLATES,
  getCheckDateDigits,
  type CheckBank,
  type CheckFieldBox,
  type CheckPrintFields,
  type CheckPrintOffset,
  type CheckTemplate,
} from "@/utils/php-check-print";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fieldStyle(box: CheckFieldBox): string {
  const parts = [
    "position:absolute",
    `top:${box.topMm}mm`,
    `left:${box.leftMm}mm`,
    `width:${box.widthMm}mm`,
    `font-size:${box.fontSizePt}pt`,
    "line-height:1.1",
    "margin:0",
    "padding:0",
    `text-align:${box.textAlign ?? "left"}`,
    `white-space:${box.whiteSpace ?? "nowrap"}`,
    "box-sizing:border-box",
    "font-family:Arial,Helvetica,sans-serif",
    "font-weight:700",
    "color:#000",
  ];
  if (box.letterSpacingEm != null && box.letterSpacingEm > 0) {
    parts.push(`letter-spacing:${box.letterSpacingEm}em`);
  }
  return parts.join(";");
}

function guideStyle(box: CheckFieldBox): string {
  return [
    "position:absolute",
    `top:${box.topMm}mm`,
    `left:${box.leftMm}mm`,
    `width:${box.widthMm}mm`,
    "min-height:4mm",
    "border:0.25mm dashed #666",
    "box-sizing:border-box",
    "pointer-events:none",
  ].join(";");
}

function renderField(
  className: string,
  box: CheckFieldBox,
  text: string,
  showGuides: boolean
): string {
  const guide = showGuides
    ? `<div class="check-guide" style="${guideStyle(box)}"></div>`
    : "";
  return `${guide}<div class="${className}" style="${fieldStyle(box)}">${escapeHtml(text)}</div>`;
}

function renderDateDigits(
  bank: CheckBank,
  template: CheckTemplate,
  dateText: string,
  showGuides: boolean,
  topInsetMm: number
): string {
  const layout = CHECK_DATE_DIGIT_LAYOUT[bank];
  const base = CHECK_TEMPLATES[bank];
  const digits = getCheckDateDigits(dateText);
  const topMm =
    (layout.topPct / 100) * template.pageHeightMm +
    (template.date.topMm - base.date.topMm) +
    topInsetMm;
  const heightMm = (layout.heightPct / 100) * template.pageHeightMm;
  const leftShiftMm = template.date.leftMm - base.date.leftMm;

  return digits
    .map((digit, i) => {
      const slot = layout.slots[i]!;
      const leftMm = (slot.left / 100) * template.pageWidthMm + leftShiftMm;
      const widthMm = (slot.width / 100) * template.pageWidthMm;
      const box: CheckFieldBox = {
        topMm,
        leftMm,
        widthMm,
        fontSizePt: 9,
        textAlign: "center",
        whiteSpace: "nowrap",
      };
      const guide = showGuides
        ? `<div class="check-guide" style="${guideStyle(box)};height:${heightMm}mm"></div>`
        : "";
      return `${guide}<div class="check-date-digit" style="${fieldStyle(box)};height:${heightMm}mm;line-height:${heightMm}mm">${escapeHtml(digit)}</div>`;
    })
    .join("");
}

function withTopInset(box: CheckFieldBox, topInsetMm: number): CheckFieldBox {
  return { ...box, topMm: box.topMm + topInsetMm };
}

export function buildPhpCheckPrintHtml(options: {
  fields: CheckPrintFields;
  offset: CheckPrintOffset;
  showGuides?: boolean;
}): string {
  const base = CHECK_TEMPLATES[options.fields.bank];
  const template: CheckTemplate = applyCheckPrintOffset(base, options.offset);
  const content = buildCheckPrintContent(options.fields);
  const showGuides = Boolean(options.showGuides);
  const topInset = CHECK_PRINT_TOP_INSET_MM;
  const pageW = CHECK_PRINT_PAGE_WIDTH_MM;
  const pageH = CHECK_PRINT_PAGE_HEIGHT_MM;

  const dateHtml = renderDateDigits(
    options.fields.bank,
    template,
    content.date,
    showGuides,
    topInset
  );

  const sheet = `
    <div class="check-sheet" style="width:${template.pageWidthMm}mm;height:${template.pageHeightMm}mm;">
      ${dateHtml}
      ${renderField("check-payee", withTopInset(template.payee, topInset), content.payee, showGuides)}
      ${renderField("check-amount-figures", withTopInset(template.amountFigures, topInset), content.amountFigures, showGuides)}
      ${renderField("check-amount-words", withTopInset(template.amountWords, topInset), content.amountWords, showGuides)}
    </div>`;

  const body = `<div class="print-page">${sheet}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Check — ${escapeHtml(template.label)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-page {
      position: relative;
      width: ${pageW}mm;
      height: ${pageH}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    .check-sheet {
      position: absolute;
      left: 0;
      top: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    .print-page div { color: #000 !important; }
    @page {
      size: ${pageW}mm ${pageH}mm;
      margin: 0;
    }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      .print-page { page-break-after: avoid !important; page-break-inside: avoid !important; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function printPhpCheckDocument(options: {
  fields: CheckPrintFields;
  offset: CheckPrintOffset;
  showGuides?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { ok: false, error: "Print is only available in the browser." };
  }

  const html = buildPhpCheckPrintHtml(options);

  // Hidden iframe (not window.open) — Chrome treats noopener popups as blocked
  // and returns null even when a blank window opens.
  const existing = document.getElementById("addbell-check-print-frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "addbell-check-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Check print");
  // Real size off-screen — 0×0 iframes often print blank in Chrome.
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:900px",
    "height:500px",
    "border:0",
    "opacity:0",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(iframe);

  const frameWin = iframe.contentWindow;
  const frameDoc = frameWin?.document;
  if (!frameWin || !frameDoc) {
    iframe.remove();
    return { ok: false, error: "Could not prepare the print frame. Try again." };
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      iframe.remove();
    } catch {
      // ignore
    }
  };

  const triggerPrint = () => {
    try {
      frameWin.focus();
      frameWin.print();
    } catch {
      cleanup();
      return;
    }
    frameWin.addEventListener("afterprint", cleanup, { once: true });
    // Fallback if afterprint never fires (some drivers)
    window.setTimeout(cleanup, 60_000);
  };

  if (frameDoc.readyState === "complete") {
    window.setTimeout(triggerPrint, 150);
  } else {
    iframe.addEventListener(
      "load",
      () => {
        window.setTimeout(triggerPrint, 150);
      },
      { once: true }
    );
  }

  return { ok: true };
}
