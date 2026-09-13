import type { PoMasterlistJob } from "@/types/po-masterlist";

export type InternalPurchaseOrderJobFill = {
  catalogProjectId: string | null;
  masterlistJobId: string;
  clientPoNumber: string;
  projectTitle: string;
  deliverTo: string;
  paymentTerms: string[] | null;
};

function trimOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function parseMasterlistPaymentTerms(
  value: string | null | undefined
): string[] | null {
  const lines = (value ?? "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : null;
}

export function fillInternalPurchaseOrderFromMasterlistJob(
  job: PoMasterlistJob
): InternalPurchaseOrderJobFill {
  return {
    catalogProjectId: job.project_id?.trim() || null,
    masterlistJobId: job.id,
    clientPoNumber: trimOrEmpty(job.po_number),
    projectTitle: trimOrEmpty(job.project_title),
    deliverTo: trimOrEmpty(job.location),
    paymentTerms: parseMasterlistPaymentTerms(job.payment_terms),
  };
}

export function matchesInternalPoJobSearch(
  job: Pick<PoMasterlistJob, "po_number" | "project_title" | "location">,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [job.po_number, job.project_title, job.location]
    .map((part) => (part ?? "").toLowerCase())
    .join("\0");
  return hay.includes(needle);
}

export function formatInternalPoJobPickerLabel(
  job: Pick<PoMasterlistJob, "po_number" | "project_title" | "location">
): string {
  return [job.po_number, job.project_title, job.location]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/** Prefer the job's catalog link; otherwise the projects row whose code is the client P.O. */
export function catalogProjectIdForInternalPo(
  job: Pick<PoMasterlistJob, "project_id">,
  catalogIdByPoCode: string | null | undefined
): string | null {
  return job.project_id?.trim() || catalogIdByPoCode?.trim() || null;
}

export const FOR_COMPLETION_OF_DETAILS = "For completion of details";

export type InternalPoMasterlistLink = {
  po_masterlist_job_id: string | null;
  masterlist_link_status: "linked" | "needs_review" | null;
  masterlist_link_note: string | null;
};

export function buildInternalPoMasterlistLink(
  job: Pick<PoMasterlistJob, "id"> | null
): InternalPoMasterlistLink {
  if (job) {
    return {
      po_masterlist_job_id: job.id,
      masterlist_link_status: "linked",
      masterlist_link_note: null,
    };
  }
  return {
    po_masterlist_job_id: null,
    masterlist_link_status: "needs_review",
    masterlist_link_note: FOR_COMPLETION_OF_DETAILS,
  };
}

export function internalPoLinkLabel(
  link: Pick<InternalPoMasterlistLink, "masterlist_link_status" | "masterlist_link_note">
): string | null {
  if (link.masterlist_link_status === "linked") return "Linked";
  if (link.masterlist_link_status === "needs_review") {
    return link.masterlist_link_note?.trim() || FOR_COMPLETION_OF_DETAILS;
  }
  return null;
}

export type InternalPoSaveInput = {
  vendorId: string;
  vendorName?: string;
  poNumber: string;
  projectTitle: string;
  selectedJob: { id: string } | null;
};

export function internalPoSaveError(input: InternalPoSaveInput): string | null {
  if (!input.vendorId.trim()) {
    return "Select or add a vendor.";
  }
  if (!input.poNumber.trim()) return "Generate a PO number first.";
  if (!input.selectedJob && !input.projectTitle.trim()) {
    return "Enter a project title.";
  }
  return null;
}

export function purchaseOrderVendorLabel(po: {
  vendors?: { name?: string | null } | null;
  vendor_snapshot?: { name?: string | null } | null;
}): string {
  const listed = po.vendors?.name?.trim();
  if (listed) return listed;
  const snapshot = po.vendor_snapshot?.name?.trim();
  return snapshot || "—";
}
