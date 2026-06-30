import { normalizeBillingPoKey } from "@/lib/billing-invoice-lookup-cache";
import { isBillingInvoiceSheetTabName } from "@/lib/subcontractor-progress-billing";
import type { SubcontractorInvoiceStatus } from "@/lib/subcontractor-progress-billing";

export type ClientInvoiceLookupResult = {
  status: SubcontractorInvoiceStatus;
  invoiceNumber: string | null;
};

const clientInvoiceCache = new Map<string, ClientInvoiceLookupResult>();
const inFlightLookups = new Map<string, Promise<ClientInvoiceLookupResult>>();
const failedLookupCache = new Map<string, { at: number; message: string }>();

const FAILED_LOOKUP_TTL_MS = 60_000;

export function getClientCachedInvoiceLookup(
  poNumber: string
): ClientInvoiceLookupResult | null {
  const key = normalizeBillingPoKey(poNumber);
  if (!key || key === "N/A") return null;
  const cached = clientInvoiceCache.get(key);
  if (!cached) return null;
  if (cached.invoiceNumber && isBillingInvoiceSheetTabName(cached.invoiceNumber)) {
    clientInvoiceCache.delete(key);
    return null;
  }
  return cached;
}

export function setClientCachedInvoiceLookup(
  poNumber: string,
  result: ClientInvoiceLookupResult
): void {
  const key = normalizeBillingPoKey(poNumber);
  if (!key || key === "N/A") return;
  clientInvoiceCache.set(key, result);
}

type InvoiceLookupApiResponse = {
  status?: SubcontractorInvoiceStatus;
  invoiceNumber?: string | null;
  /** @deprecated Older API responses */
  sheetName?: string | null;
  error?: string;
  message?: string;
  cached?: boolean;
};

export class InvoiceLookupNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceLookupNotConfiguredError";
  }
}

export async function fetchSubcontractorInvoiceStatus(
  poNumber: string
): Promise<ClientInvoiceLookupResult> {
  const po = poNumber.trim();
  const key = normalizeBillingPoKey(po);
  if (!key || key === "N/A") {
    return { status: "NOT FOUND", invoiceNumber: null };
  }

  const cached = clientInvoiceCache.get(key);
  if (cached) return cached;

  const failed = failedLookupCache.get(key);
  if (failed && Date.now() - failed.at < FAILED_LOOKUP_TTL_MS) {
    throw new Error(failed.message);
  }

  const pending = inFlightLookups.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const response = await fetch("/api/fund-requests/subcontractor-invoice-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ po_number: po }),
    });

    const payload = (await response.json()) as InvoiceLookupApiResponse;

    if (!response.ok) {
      if (payload.error === "not_configured") {
        throw new InvoiceLookupNotConfiguredError(
          payload.message ||
            "Billing sheet lookup is not configured yet. Your selection was saved locally."
        );
      }
      const message = payload.error || payload.message || "Lookup failed";
      failedLookupCache.set(key, { at: Date.now(), message });
      throw new Error(message);
    }

    failedLookupCache.delete(key);

    const result: ClientInvoiceLookupResult = {
      status: payload.status ?? "NOT FOUND",
      invoiceNumber: payload.invoiceNumber ?? null,
    };
    if (result.invoiceNumber && isBillingInvoiceSheetTabName(result.invoiceNumber)) {
      result.invoiceNumber = null;
    }
    clientInvoiceCache.set(key, result);
    return result;
  })().finally(() => {
    inFlightLookups.delete(key);
  });

  inFlightLookups.set(key, promise);
  return promise;
}
