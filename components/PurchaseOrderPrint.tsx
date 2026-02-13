"use client";

import { forwardRef } from "react";
import { formatCurrency } from "@/utils/format";
import type { PurchaseOrder } from "@/types/purchase-order";

/** Addbell brand colors - from logo (reddish-brown/sepia + blue) */
const COLORS = {
  blue: "#1e40af",
  blueLight: "#3b82f6",
  blueMuted: "#dbeafe",
  sepia: "#8B6354",
  sepiaLight: "#f5f0ed",
  dark: "#1e293b",
  muted: "#64748b",
};

interface PurchaseOrderPrintProps {
  data: PurchaseOrder;
}

/**
 * Printable Purchase Order - Addbell branded, professional format
 */
export const PurchaseOrderPrint = forwardRef<
  HTMLDivElement,
  PurchaseOrderPrintProps
>(function PurchaseOrderPrint({ data }, ref) {
  const grandTotal = data.items.reduce((sum, i) => sum + i.totalAmount, 0);

  return (
    <div
      ref={ref}
      className="po-print-root bg-white mx-auto"
      style={{
        fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        maxWidth: "186mm",
        width: "100%",
        padding: "12mm",
        fontSize: "11px",
        color: COLORS.dark,
        lineHeight: 1.5,
        overflow: "visible",
      }}
    >
      {/* Header - print: grayscale, no heavy colors */}
      <div
        className="po-header"
        style={{
          margin: "-12mm -12mm 0 -12mm",
          padding: "10mm 12mm 10mm",
          borderBottom: "2px solid #333",
          backgroundColor: "#fff",
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
            overflow: "visible",
          }}
        >
          <div style={{ flexShrink: 0, overflow: "visible" }}>
            <img
              src="/addbell-po-logo.png"
              alt="Addbell Technical Services"
              width={220}
              height={48}
              style={{ objectFit: "contain", display: "block", width: "220px", height: "auto" }}
            />
          </div>
          <div style={{ textAlign: "right" }} className="po-title">
            <h1
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: COLORS.dark,
              }}
            >
              Purchase Order
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "10px",
                color: COLORS.muted,
                maxWidth: "240px",
              }}
            >
              Please provide this PO number on all invoices and delivery receipts.
            </p>
          </div>
        </div>
      </div>

      {/* PO Number, Date, Status, Print Time - print: borders only, no fill */}
      <div
        className="po-po-bar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px 32px",
          marginTop: "12px",
          padding: "10px 12px",
          border: "1px solid #333",
          borderRadius: "4px",
          alignItems: "center",
        }}
      >
        <div>
          <span
            className="po-text-blue"
            style={{
              fontSize: "9px",
              fontWeight: 600,
              textTransform: "uppercase",
              color: COLORS.dark,
              letterSpacing: "0.04em",
              display: "block",
            }}
          >
            PO No.
          </span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: COLORS.dark }}>
            {data.poNumber}
          </span>
        </div>
        <div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              textTransform: "uppercase",
              color: COLORS.dark,
              letterSpacing: "0.04em",
              display: "block",
            }}
          >
            Date
          </span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: COLORS.dark }}>
            {data.date}
          </span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              padding: "4px 8px",
              border: "1px solid #333",
              borderRadius: "4px",
              color: COLORS.dark,
              letterSpacing: "0.04em",
            }}
          >
            ORIGINAL COPY
          </span>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              color: COLORS.muted,
            }}
          >
            P.O. Approved
          </span>
          {data.printTimestamp && (
            <span style={{ fontSize: "8px", color: COLORS.muted }}>
              Print: {new Date(data.printTimestamp).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>
      </div>

      {/* Legal disclaimers - print: border only */}
      <div
        className="po-legal"
        style={{
          marginTop: "10px",
          padding: "6px 10px",
          border: "1px solid #333",
          borderRadius: "4px",
          fontSize: "8px",
          color: COLORS.dark,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, color: COLORS.dark }}>
          This document is not valid for claim of input tax.
        </div>
        <div style={{ marginTop: "2px" }}>
          This Purchase Order shall be valid for five (5) years from the date of acknowledgement.
        </div>
      </div>

      {/* Vendor | Buyer - two columns with styled boxes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginTop: "20px",
          alignItems: "stretch",
        }}
      >
        {[
          {
            title: "Vendor / Supplier",
            borderColor: "#333",
            bg: "#fff",
            data: {
              name: data.vendor.name,
              tin: data.vendor.tin,
              address: data.vendor.address,
              phone: data.vendor.phone,
              email: data.vendor.email,
              extra: `Requisitioner: ${data.requisitioner}`,
            },
          },
          {
            title: "Buyer / Company",
            borderColor: "#333",
            bg: "#fff",
            data: {
              name: data.company.name,
              tin: data.company.tin,
              address: data.company.address,
              phone: data.company.phone,
              email: data.company.email,
              extra: null,
            },
          },
        ].map((block) => (
          <div
            key={block.title}
            style={{
              border: `1px solid ${block.borderColor}`,
              borderRadius: "8px",
              padding: "14px",
              backgroundColor: block.bg,
              minHeight: "100px",
              overflow: "hidden",
            }}
            className={block.title.includes("Vendor") ? "po-vendor-box" : "po-buyer-box"}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "10px",
                color: COLORS.dark,
              }}
            >
              {block.title}
            </div>
            <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "12px", color: COLORS.dark, wordBreak: "break-word" }}>
              {block.data.name}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "10px", color: COLORS.muted }}>
              TIN: {block.data.tin}
            </p>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: "10px",
                color: COLORS.dark,
                wordBreak: "break-word",
                overflowWrap: "break-word",
                lineHeight: 1.35,
              }}
            >
              {block.data.address}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "10px" }}>
              Tel: {block.data.phone}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: "10px" }}>
              Email: {block.data.email}
            </p>
            {block.data.extra && (
              <p
                style={{
                  margin: 0,
                  paddingTop: "8px",
                  borderTop: "1px solid rgba(0,0,0,0.1)",
                  fontSize: "10px",
                  fontWeight: 500,
                }}
              >
                {block.data.extra}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Project & Deliver To */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.dark,
              letterSpacing: "0.03em",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Project Title
          </span>
          <p
            style={{
              margin: 0,
              padding: "8px 0",
              borderBottom: "1px solid #333",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            {data.projectTitle}
          </p>
        </div>
        <div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.dark,
              letterSpacing: "0.03em",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Ship / Deliver To
          </span>
          <p
            style={{
              margin: 0,
              padding: "8px 0",
              borderBottom: "1px solid #333",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            {data.deliverTo}
          </p>
        </div>
      </div>

      {/* Intro line - professional */}
      <p
        style={{
          marginTop: "16px",
          fontSize: "10px",
          color: COLORS.dark,
          fontStyle: "italic",
        }}
      >
        Please deliver the following goods/services as specified in accordance with the terms and conditions herein:
      </p>

      {/* Line Items Table - print: light gray header, no blue */}
      <div style={{ marginTop: "12px", overflow: "visible", borderRadius: "4px", border: "1px solid #333" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "9px",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr className="po-table-header" style={{ backgroundColor: "#e5e5e5", color: "#000" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, width: "4%", fontSize: "8px" }}>#</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, width: "48%", fontSize: "8px" }}>Description of Materials and/or Services</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, width: "10%", fontSize: "8px" }}>Qty</th>
              <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, width: "16%", fontSize: "8px" }}>Unit Price</th>
              <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, width: "18%", fontSize: "8px" }}>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr
                key={item.itemNo}
                style={{
                  backgroundColor: idx % 2 === 0 ? "#fff" : "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <td style={{ padding: "5px 6px", verticalAlign: "top", fontSize: "9px" }}>{item.itemNo}</td>
                <td style={{ padding: "5px 6px", verticalAlign: "top", fontSize: "9px", wordBreak: "break-word" }}>{item.description}</td>
                <td style={{ padding: "5px 6px", textAlign: "center", verticalAlign: "top", fontSize: "9px" }}>{item.qty}</td>
                <td style={{ padding: "5px 6px", textAlign: "right", verticalAlign: "top", fontSize: "9px" }}>{formatCurrency(item.unitPrice)}</td>
                <td
                  style={{
                    padding: "5px 6px",
                    textAlign: "right",
                    verticalAlign: "top",
                    fontWeight: 600,
                    fontSize: "9px",
                  }}
                >
                  {formatCurrency(item.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total & Conforme */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "20px",
          gap: "24px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.dark,
              letterSpacing: "0.03em",
              display: "block",
              marginBottom: "6px",
            }}
          >
            Conforme (Vendor Acceptance)
          </span>
          <div
            style={{
              width: "180px",
              height: "36px",
              borderBottom: "1px solid #333",
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: "9px", color: COLORS.muted }}>
            Signature over Printed Name
          </p>
        </div>
        <div
          className="po-total-box"
          style={{
            textAlign: "right",
            padding: "10px 14px",
            border: "1px solid #333",
            borderRadius: "4px",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.dark,
              display: "block",
              marginBottom: "4px",
            }}
          >
            Approximate Total
          </span>
          <span style={{ fontSize: "16px", fontWeight: 700 }}>
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      {/* Payment Terms - print: border only */}
      <div
        className="po-payment-box"
        style={{
          marginTop: "16px",
          padding: "10px 12px",
          border: "1px solid #333",
          borderRadius: "4px",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            textTransform: "uppercase",
            color: COLORS.dark,
            letterSpacing: "0.03em",
            display: "block",
            marginBottom: "6px",
          }}
        >
          Payment Terms
        </span>
        <div style={{ fontSize: "10px", lineHeight: 1.7 }}>
          {data.paymentTerms.map((term, i) => (
            <div key={i} style={{ marginBottom: "4px" }}>
              • {term}
            </div>
          ))}
        </div>
      </div>

      {/* Four signatories */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginTop: "20px",
          paddingTop: "14px",
          borderTop: "1px solid #333",
        }}
      >
        {[
          { label: "Requested By", value: data.requestedBy, sub: "" },
          { label: "Prepared By", value: data.preparedBy, sub: "Purchasing" },
          { label: "Reviewed By", value: data.reviewedBy, sub: "" },
          { label: "Approved By", value: data.approvedBy, sub: data.approvedByTitle },
        ].map((sig) => (
          <div key={sig.label}>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: COLORS.dark,
                letterSpacing: "0.03em",
                display: "block",
                marginBottom: "4px",
              }}
            >
              {sig.label}
            </span>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "11px", color: COLORS.dark }}>
              {sig.value || "—"}
            </p>
            {sig.sub && (
              <p style={{ margin: "2px 0 0", fontSize: "9px", color: COLORS.muted }}>
                {sig.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Contact footer */}
      <p
        style={{
          marginTop: "16px",
          fontSize: "9px",
          color: COLORS.muted,
          textAlign: "center",
        }}
      >
        If you have any questions about this purchase order, please email admin@addbell.com
      </p>
    </div>
  );
});