/**
 * Purchase Order types - matches Addbell PO format and construction industry standards
 */

export interface PurchaseOrderLineItem {
  itemNo: number;
  description: string;
  qty: string;
  unitPrice: number;
  totalAmount: number;
}

export interface PurchaseOrderVendor {
  name: string;
  contactPerson: string;
  tin: string;
  address: string;
  phone: string;
  email: string;
}

export interface PurchaseOrderCompany {
  name: string;
  tin: string;
  address: string;
  phone: string;
  email: string;
}

export interface PurchaseOrder {
  poNumber: string;
  date: string;
  vendor: PurchaseOrderVendor;
  requisitioner: string;
  company: PurchaseOrderCompany;
  projectTitle: string;
  deliverTo: string;
  /** Shown when purchasing created the PO without a client P.O. yet. */
  basisNote?: string;
  items: PurchaseOrderLineItem[];
  paymentTerms: string[];
  requestedBy: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  approvedByTitle: string;
  /** Auto-set when printing - ISO string */
  printTimestamp?: string;
}

/** Default Addbell company info - from sample PO */
export const DEFAULT_COMPANY: PurchaseOrderCompany = {
  name: "ADD-BELL TECHNICAL SERVICES, INC.",
  tin: "293 128 460 000000",
  address: "BLK 6 LOT 26 LONDON ST. VILLA OLYMPIA 1 BRGY. MAHARLIKA SAN PEDRO, LAGUNA",
  phone: "(02) 7117-1628",
  email: "admin@addbell.com / phen.conte@addbell.com",
};

/** Default payment terms — empty until a preset or manual term is chosen. */
export const DEFAULT_PAYMENT_TERMS: string[] = [];