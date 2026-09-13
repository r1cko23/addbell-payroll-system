import { PO_MASTERLIST_SHEET_HEADERS } from "@/lib/po-masterlist-sheet-row";
import type { PoMasterlistEditableColumn } from "@/lib/po-masterlist-column-acl";

export const PO_MASTERLIST_WRAP_CELL_CLASS =
  "whitespace-normal break-words";

export const PO_MASTERLIST_HEADER_CLASS =
  "whitespace-normal break-normal leading-tight";

export const PO_MASTERLIST_CELL_ALIGN_CLASS = "text-center align-middle";

export type PoMasterlistGridColumn = {
  key: PoMasterlistEditableColumn;
  header: string;
  wrap?: boolean;
  truncate?: boolean;
  frozen?: boolean;
  numeric?: boolean;
  expand?: boolean;
  widthClass: string;
};

export const PO_MASTERLIST_GRID_COLUMNS: readonly PoMasterlistGridColumn[] = [
  {
    key: "po_date",
    header: PO_MASTERLIST_SHEET_HEADERS[0],
    widthClass: "w-[7.5%]",
  },
  {
    key: "po_number",
    header: PO_MASTERLIST_SHEET_HEADERS[2],
    wrap: true,
    frozen: true,
    widthClass: "w-[9%]",
  },
  {
    key: "po_amount",
    header: PO_MASTERLIST_SHEET_HEADERS[3],
    numeric: true,
    widthClass: "w-[7%]",
  },
  {
    key: "project_title",
    header: PO_MASTERLIST_SHEET_HEADERS[4],
    wrap: true,
    expand: true,
    widthClass: "w-[17%]",
  },
  {
    key: "client_name",
    header: PO_MASTERLIST_SHEET_HEADERS[5],
    wrap: true,
    expand: true,
    widthClass: "w-[11%]",
  },
  {
    key: "location",
    header: PO_MASTERLIST_SHEET_HEADERS[6],
    wrap: true,
    expand: true,
    widthClass: "w-[11%]",
  },
  {
    key: "payment_terms",
    header: PO_MASTERLIST_SHEET_HEADERS[7],
    wrap: true,
    widthClass: "w-[6.5%]",
  },
  {
    key: "project_status",
    header: PO_MASTERLIST_SHEET_HEADERS[10],
    widthClass: "w-[7%]",
  },
  {
    key: "payment_status",
    header: PO_MASTERLIST_SHEET_HEADERS[11],
    widthClass: "w-[8%]",
  },
  {
    key: "invoice_numbers",
    header: PO_MASTERLIST_SHEET_HEADERS[12],
    wrap: true,
    expand: true,
    widthClass: "w-[9%]",
  },
  {
    key: "general_remarks",
    header: PO_MASTERLIST_SHEET_HEADERS[13],
    wrap: true,
    expand: true,
    widthClass: "w-[7%]",
  },
];
