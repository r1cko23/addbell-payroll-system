"use client";

import { forwardRef, type CSSProperties } from "react";
import {
  summarizeFundRequestPayment,
  type FundRequestClientGroup,
  type FundRequestInboxRow,
} from "@/lib/fund-request-inbox-grouping";

export const FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX = 600;

type FundRequestApprovedExportPayeeSheetProps = {
  group: FundRequestClientGroup;
  groupIndex: number;
  groupCount: number;
  cutoffLabel: string;
  generatedAt: string;
  grandTotal: number;
  getRequesterName: (row: FundRequestInboxRow) => string;
};

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const sheetStyle: CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  width: "100%",
  maxWidth: `${FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX}px`,
  margin: "0 auto",
  padding: "24px",
  boxSizing: "border-box",
};

export const FundRequestApprovedExportPayeeSheet = forwardRef<
  HTMLDivElement,
  FundRequestApprovedExportPayeeSheetProps
>(function FundRequestApprovedExportPayeeSheet(
  {
    group,
    groupIndex,
    groupCount,
    cutoffLabel,
    generatedAt,
    grandTotal,
    getRequesterName,
  },
  ref
) {
  return (
    <div ref={ref} style={sheetStyle}>
      <div
        style={{
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "16px",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#047857",
          }}
        >
          Add-bell Technical Services
        </p>
        <h2
          style={{
            margin: "6px 0 0",
            fontSize: "20px",
            fontWeight: 700,
            lineHeight: 1.3,
            color: "#0f172a",
          }}
        >
          Fund Requests — Approved (Upper Management)
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: "14px", color: "#475569" }}>
          Cutoff: {cutoffLabel}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
          Payee {groupIndex + 1} of {groupCount} · Generated {generatedAt}
        </p>
      </div>

      <div
        style={{
          border: "1px solid #a7f3d0",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            padding: "14px 16px",
            backgroundColor: "#ecfdf5",
            borderBottom: "1px solid #a7f3d0",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                lineHeight: 1.35,
                color: "#022c22",
                wordBreak: "break-word",
              }}
            >
              {group.clientName}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#047857" }}>
              {group.requests.length} payable
              {group.requests.length === 1 ? "" : "s"}
            </p>
          </div>
          <p
            style={{
              margin: 0,
              flexShrink: 0,
              fontSize: "18px",
              fontWeight: 700,
              color: "#022c22",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPhp(group.subtotalNet)}
          </p>
        </div>

        {group.requests.map((request, index) => {
          const summary = summarizeFundRequestPayment(request);
          const isLast = index === group.requests.length - 1;
          return (
            <div
              key={request.id}
              style={{
                padding: "12px 16px",
                backgroundColor: "#ffffff",
                borderBottom: isLast ? "none" : "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      lineHeight: 1.4,
                      color: "#0f172a",
                      wordBreak: "break-word",
                    }}
                  >
                    {index + 1}. {summary.label}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      color: "#64748b",
                      wordBreak: "break-word",
                    }}
                  >
                    {getRequesterName(request)}
                    {request.po_number?.trim() ? ` · ${request.po_number.trim()}` : ""}
                  </p>
                </div>
                <p
                  style={{
                    margin: 0,
                    flexShrink: 0,
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPhp(summary.netAmount)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          margin: "16px 0 0",
          textAlign: "center",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        Cutoff total (all {groupCount} payees): {formatPhp(grandTotal)}
      </p>
    </div>
  );
});

export function slugifyFundRequestPayeeFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "payee";
}

export type { FundRequestClientGroup };
