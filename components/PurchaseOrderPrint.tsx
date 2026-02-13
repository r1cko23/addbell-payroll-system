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
      className="bg-white mx-auto"
      style={{
        fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        maxWidth: "210mm",
        padding: "18mm",
        fontSize: "11px",
        color: COLORS.dark,
        lineHeight: 1.5,
      }}
    >
      {/* Header - white with blue accent bar, logo in full color */}
      <div
        style={{
          margin: "-18mm -18mm 0 -18mm",
          padding: "14mm 18mm 12mm",
          borderBottom: `4px solid ${COLORS.blue}`,
          backgroundColor: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <img
            src="/addbell-po-logo.png"
            alt="Addbell Technical Services"
            width={300}
            height={56}
            style={{ objectFit: "contain" }}
          />
          <div style={{ textAlign: "right" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: COLORS.blue,
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

      {/* PO Number & Date - accent bar */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          marginTop: "16px",
          padding: "12px 14px",
          backgroundColor: COLORS.blueMuted,
          borderRadius: "8px",
          borderLeft: `4px solid ${COLORS.blue}`,
        }}
      >
        <div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              textTransform: "uppercase",
              color: COLORS.blue,
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
              color: COLORS.blue,
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
            borderColor: COLORS.sepia,
            bg: COLORS.sepiaLight,
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
            borderColor: COLORS.blue,
            bg: COLORS.blueMuted,
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
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "10px",
                color: block.borderColor,
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
              color: COLORS.blue,
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
              borderBottom: `2px solid ${COLORS.blue}`,
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
              color: COLORS.blue,
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
              borderBottom: `2px solid ${COLORS.blue}`,
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            {data.deliverTo}
          </p>
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ marginTop: "20px", overflow: "hidden", borderRadius: "8px", border: `1px solid ${COLORS.blue}` }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: COLORS.blue, color: "#fff" }}>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  width: "36px",
                  fontSize: "9px",
                  letterSpacing: "0.03em",
                }}
              >
                #
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: "9px",
                  letterSpacing: "0.03em",
                }}
              >
                Description of Materials and/or Services
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "center",
                  fontWeight: 600,
                  width: "56px",
                  fontSize: "9px",
                }}
              >
                Qty
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "right",
                  fontWeight: 600,
                  width: "78px",
                  fontSize: "9px",
                }}
              >
                Unit Price
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "right",
                  fontWeight: 600,
                  width: "88px",
                  fontSize: "9px",
                }}
              >
                Total Amount
              </th>
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
                <td style={{ padding: "8px 12px", verticalAlign: "top" }}>
                  {item.itemNo}
                </td>
                <td style={{ padding: "8px 12px", verticalAlign: "top" }}>
                  {item.description}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "top" }}>
                  {item.qty}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", verticalAlign: "top" }}>
                  {formatCurrency(item.unitPrice)}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    verticalAlign: "top",
                    fontWeight: 600,
                    color: COLORS.dark,
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
              color: COLORS.sepia,
              letterSpacing: "0.03em",
              display: "block",
              marginBottom: "6px",
            }}
          >
            Conforme (Vendor Acceptance)
          </span>
          <div
            style={{
              width: "200px",
              height: "40px",
              borderBottom: `2px solid ${COLORS.dark}`,
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: "9px", color: COLORS.muted }}>
            Signature over Printed Name
          </p>
        </div>
        <div
          style={{
            textAlign: "right",
            padding: "12px 16px",
            backgroundColor: COLORS.blueMuted,
            borderRadius: "8px",
            border: `1px solid ${COLORS.blue}`,
          }}
        >
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.blue,
              display: "block",
              marginBottom: "4px",
            }}
          >
            Approximate Total
          </span>
          <span style={{ fontSize: "18px", fontWeight: 700, color: COLORS.blue }}>
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      {/* Payment Terms */}
      <div
        style={{
          marginTop: "20px",
          padding: "14px",
          backgroundColor: COLORS.sepiaLight,
          borderRadius: "8px",
          border: `1px solid ${COLORS.sepia}`,
        }}
      >
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            textTransform: "uppercase",
            color: COLORS.sepia,
            letterSpacing: "0.03em",
            display: "block",
            marginBottom: "8px",
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

      {/* Signatures */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "24px",
          paddingTop: "18px",
          borderTop: `2px solid ${COLORS.blue}`,
          gap: "24px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.blue,
              letterSpacing: "0.03em",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Prepared By
          </span>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "12px", color: COLORS.dark }}>
            {data.preparedBy}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "9px", color: COLORS.muted }}>
            Purchasing
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.blue,
              letterSpacing: "0.03em",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Approved By
          </span>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "12px", color: COLORS.dark }}>
            {data.approvedBy}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "9px", color: COLORS.muted }}>
            {data.approvedByTitle}
          </p>
        </div>
      </div>
    </div>
  );
});
