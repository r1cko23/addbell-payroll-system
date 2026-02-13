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
  items: PurchaseOrderLineItem[];
  paymentTerms: string[];
  preparedBy: string;
  approvedBy: string;
  approvedByTitle: string;
}

/** Default Addbell company info - from sample PO */
export const DEFAULT_COMPANY: PurchaseOrderCompany = {
  name: "ADD-BELL TECHNICAL SERVICES, INC.",
  tin: "293 128 460 000000",
  address: "13 Rd. 3 Dona Petra Compd. Tumana 1806 Marikina City 2nd Dist.",
  phone: "(02) 7117-1628",
  email: "admin@addbell.com / phen.conte@addbell.com",
};

/** Default payment terms - from sample PO */
export const DEFAULT_PAYMENT_TERMS = [
  "30% Down Payment",
  "30% Progress Billing (after 7 days)",
  "30% Progress Billing (after 7 days)",
  "10% Retention (7 to 15 days after COC)",
];
