"use client";

import type { CSSProperties } from "react";
import {
  applyCheckPrintOffset,
  ADDBELL_CHECK_ACCOUNT_NAME,
  CHECK_DATE_DIGIT_LAYOUT,
  CHECK_TEMPLATES,
  getCheckDateDigits,
  getOfficialBlankSampleSrc,
  type CheckBank,
  type CheckFieldBox,
  type CheckPrintOffset,
} from "@/utils/php-check-print";
import { cn } from "@/lib/utils";

export type CheckLayoutPreviewContent = {
  date: string;
  payee: string;
  amountFigures: string;
  amountWords: string;
};

type FundRequestCheckLayoutPreviewProps = {
  bank: CheckBank;
  offset: CheckPrintOffset;
  content: CheckLayoutPreviewContent | null;
  className?: string;
};

function pct(mm: number, totalMm: number): string {
  return `${(mm / totalMm) * 100}%`;
}

function overlayFieldStyle(
  box: CheckFieldBox,
  pageWidthMm: number,
  pageHeightMm: number,
  extra?: CSSProperties
): CSSProperties {
  return {
    position: "absolute",
    top: pct(box.topMm, pageHeightMm),
    left: pct(box.leftMm, pageWidthMm),
    width: pct(box.widthMm, pageWidthMm),
    fontSize: `${box.fontSizePt}pt`,
    lineHeight: 1,
    textAlign: box.textAlign ?? "left",
    whiteSpace: box.whiteSpace ?? "nowrap",
    overflow: "hidden",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 700,
    color: "#111",
    ...extra,
  };
}

/**
 * Same PCHC layout as the BDO blank — BPI only swaps palette + bank naming.
 */
function BpiStockChrome() {
  const layout = CHECK_DATE_DIGIT_LAYOUT.bpi;
  const accent = "#b91c1c";
  const line = "#7f1d1d";
  const dashLefts = [
    layout.slots[1]!.left + layout.slots[1]!.width + 0.2,
    layout.slots[3]!.left + layout.slots[3]!.width + 0.2,
  ];

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: "#f7f0d8",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(140,110,40,0.06) 0 1px, transparent 1px 3px)",
        color: accent,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
      aria-hidden
    >
      <div
        className="absolute left-[0.8%] top-[8%] bottom-[8%] flex w-[2.2%] items-center justify-center"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        <span className="text-[5px] font-semibold tracking-wide text-neutral-600">
          DOCUMENTARY STAMPS PAID
        </span>
      </div>

      <div className="absolute left-[4%] right-[4%] top-[2.5%] flex justify-between text-[5.5px] font-semibold uppercase tracking-wide text-neutral-600">
        <span className="w-[22%]">
          Account No.
          <span className="mt-0.5 block h-[4px] rounded-[1px] bg-neutral-300/90" />
        </span>
        <span className="w-[34%]">
          Account Name
          <span className="mt-0.5 block truncate text-[6.5px] font-bold leading-tight text-neutral-900 normal-case tracking-normal">
            {ADDBELL_CHECK_ACCOUNT_NAME}
          </span>
        </span>
        <span className="w-[16%]">
          Check No.
          <span className="mt-0.5 block h-[4px] rounded-[1px] bg-neutral-300/90" />
        </span>
        <span className="w-[12%]">
          BRSTN
          <span className="mt-0.5 block h-[4px] rounded-[1px] bg-neutral-300/90" />
        </span>
      </div>

      <div
        className="absolute text-[6px] font-bold uppercase tracking-wide"
        style={{
          top: `${layout.topPct - 0.5}%`,
          left: `${layout.slots[0]!.left - 5.2}%`,
          color: accent,
        }}
      >
        Date
      </div>

      {layout.slots.map((slot, i) => (
        <div
          key={`box-${i}`}
          className="absolute border bg-white"
          style={{
            top: `${layout.topPct}%`,
            left: `${slot.left}%`,
            width: `${slot.width}%`,
            height: `${layout.heightPct}%`,
            borderColor: line,
          }}
        />
      ))}

      {dashLefts.map((left, i) => (
        <div
          key={`dash-${i}`}
          className="absolute flex items-center justify-center text-[8px] font-bold leading-none"
          style={{
            top: `${layout.topPct}%`,
            left: `${left}%`,
            width: "0.9%",
            height: `${layout.heightPct}%`,
            color: accent,
          }}
        >
          -
        </div>
      ))}

      <div
        className="absolute text-[4.5px] font-semibold tracking-[0.28em] text-neutral-600"
        style={{
          top: `${layout.topPct + layout.heightPct + 0.5}%`,
          left: `${layout.slots[0]!.left}%`,
          width: `${
            layout.slots[7]!.left +
            layout.slots[7]!.width -
            layout.slots[0]!.left
          }%`,
        }}
      >
        M M&nbsp;&nbsp;D D&nbsp;&nbsp;Y Y Y Y
      </div>

      <div
        className="absolute left-[3.5%] text-[6.5px] font-bold uppercase leading-tight"
        style={{ top: "28%", color: accent }}
      >
        Pay to
        <br />
        the order of
      </div>
      <div
        className="absolute"
        style={{
          top: "34%",
          left: "20%",
          width: "48%",
          borderBottom: `1px solid ${line}`,
        }}
      />

      <div
        className="absolute text-[12px] font-bold leading-none"
        style={{ top: "26.5%", left: "71%", color: accent }}
      >
        ₱
      </div>
      <div
        className="absolute border bg-white"
        style={{
          top: "25.5%",
          left: "74.5%",
          width: "21%",
          height: "9%",
          borderColor: line,
        }}
      />

      <div
        className="absolute left-[3.5%] text-[7px] font-bold uppercase"
        style={{ top: "40%", color: accent }}
      >
        Pesos
      </div>
      <div
        className="absolute"
        style={{
          top: "44%",
          left: "14%",
          width: "78%",
          borderBottom: `1px solid ${line}`,
        }}
      />
      <div
        className="absolute rounded-[1px] bg-neutral-300/70"
        style={{ top: "46%", left: "14%", width: "78%", height: "3.5%" }}
      />

      <p
        className="absolute left-[3.5%] right-[40%] text-[4.5px] italic leading-snug text-neutral-600"
        style={{ top: "54%" }}
      >
        I / We allow the electronic clearing of this check and hereby waive the
        presentation for payment of this original to Bank of the Philippine
        Islands.
      </p>

      <div
        className="absolute left-[3.5%] flex items-center"
        style={{ top: "68%" }}
      >
        <img
          src="/check-samples/bpi-logo.png"
          alt="Bank of the Philippine Islands"
          className="h-8 w-auto max-w-[42%] object-contain object-left"
          draggable={false}
        />
      </div>

      <div
        className="absolute flex gap-[2%]"
        style={{ top: "66%", left: "58%", width: "38%", height: "26%" }}
      >
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 flex-col">
            <div
              className="flex-1 rounded-[1px] border bg-white"
              style={{ borderColor: line }}
            />
            <p className="mt-0.5 text-center text-[4.5px] font-semibold uppercase tracking-wide text-neutral-700">
              Authorized signature(s)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintFieldsOverlay({
  bank,
  offset,
  content,
}: {
  bank: CheckBank;
  offset: CheckPrintOffset;
  content: CheckLayoutPreviewContent | null;
}) {
  const base = CHECK_TEMPLATES[bank];
  const template = applyCheckPrintOffset(base, offset);
  const { pageWidthMm, pageHeightMm } = template;
  const dateText = content?.date ?? "08-10-2026";
  const payeeText = content?.payee || "PAYEE NAME";
  const amountFigures = content?.amountFigures ?? "0.00";
  const amountWords = content?.amountWords ?? "ZERO PESOS ONLY";
  const digits = getCheckDateDigits(dateText);
  const dateLayout = CHECK_DATE_DIGIT_LAYOUT[bank];

  const ox = (offset.offsetXMm / pageWidthMm) * 100;
  const oy = (offset.offsetYMm / pageHeightMm) * 100;

  return (
    <>
      {digits.map((digit, i) => {
        const slot = dateLayout.slots[i]!;
        return (
          <div
            key={`d-${i}`}
            className="pointer-events-none absolute z-10 flex items-center justify-center font-bold tabular-nums text-black"
            style={{
              top: `${dateLayout.topPct + oy}%`,
              left: `${slot.left + ox}%`,
              width: `${slot.width}%`,
              height: `${dateLayout.heightPct}%`,
              fontSize: "clamp(8px, 1.35vw, 11px)",
              fontFamily: "Arial, Helvetica, sans-serif",
              lineHeight: 1,
              textAlign: "center",
            }}
          >
            {digit}
          </div>
        );
      })}

      <div
        className="pointer-events-none absolute z-10 truncate font-bold text-black"
        style={overlayFieldStyle(template.payee, pageWidthMm, pageHeightMm, {
          fontSize: "clamp(9px, 1.45vw, 11px)",
        })}
        title={payeeText}
      >
        {payeeText}
      </div>

      <div
        className="pointer-events-none absolute z-10 font-bold tabular-nums text-black"
        style={overlayFieldStyle(
          template.amountFigures,
          pageWidthMm,
          pageHeightMm,
          {
            fontSize: "clamp(10px, 1.55vw, 12px)",
            paddingLeft: "0.6%",
          }
        )}
      >
        {amountFigures}
      </div>

      <div
        className="pointer-events-none absolute z-10 truncate font-bold text-black"
        style={overlayFieldStyle(
          template.amountWords,
          pageWidthMm,
          pageHeightMm,
          {
            fontSize: "clamp(7px, 1.15vw, 9px)",
            whiteSpace: "nowrap",
          }
        )}
        title={amountWords}
      >
        {amountWords}
      </div>
    </>
  );
}

function OfficialBlankOverlay({
  bank,
  offset,
  content,
}: {
  bank: CheckBank;
  offset: CheckPrintOffset;
  content: CheckLayoutPreviewContent | null;
}) {
  const template = CHECK_TEMPLATES[bank];
  const { pageWidthMm, pageHeightMm } = template;
  const blankSrc = getOfficialBlankSampleSrc(bank);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[2px] border border-slate-300 bg-white shadow-sm"
      style={{ aspectRatio: `${pageWidthMm} / ${pageHeightMm}` }}
      aria-label={`${template.label} print overlay`}
    >
      {bank === "bpi" ? (
        <BpiStockChrome />
      ) : blankSrc ? (
        <img
          src={blankSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
      ) : null}

      <PrintFieldsOverlay bank={bank} offset={offset} content={content} />
    </div>
  );
}

export function FundRequestCheckLayoutPreview({
  bank,
  offset,
  content,
  className,
}: FundRequestCheckLayoutPreviewProps) {
  const template = CHECK_TEMPLATES[bank];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {template.label} print overlay
        </p>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold text-white",
            bank === "bpi" ? "bg-red-700" : "bg-slate-800"
          )}
        >
          {bank.toUpperCase()}
        </span>
      </div>

      <OfficialBlankOverlay bank={bank} offset={offset} content={content} />

      <p className="text-[11px] text-muted-foreground">
        Same PCHC field layout for BDO and BPI
        {bank === "bpi" ? " (BPI colors + naming)" : ""} · date digits centered
        · figures left near ₱ · Use ←→↑↓ if your printer drifts.
      </p>
    </div>
  );
}
