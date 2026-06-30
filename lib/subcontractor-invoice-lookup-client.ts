import { normalizeBillingPoKey } from "@/lib/billing-invoice-lookup-cache";
import type { SubcontractorInvoiceStatus } from "@/lib/subcontractor-progress-billing";

export type ClientInvoiceLookupResult = {
  status: SubcontractorInvoiceStatus;
  sheetName: string | null;
};

const clientInvoiceCache = new Map<string, ClientInvoiceLookupResult>();
const inFlightLookups = new Map<string, Promise<ClientInvoiceLookupResult>>();

export function getClientCachedInvoiceLookup(
  poNumber: string
): ClientInvoiceLookupResult | null {
  const key = normalizeBillingPoKey(poNumber);
  if (!key || key === "N/A") return null;
  return clientInvoiceCache.get(key) ?? null;
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
    return { status: "NOT FOUND", sheetName: null };
  }

  const cached = clientInvoiceCache.get(key);
  if (cached) return cached;

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
      throw new Error(payload.error || payload.message || "Lookup failed");
    }

    const result: ClientInvoiceLookupResult = {
      status: payload.status ?? "NOT FOUND",
      sheetName: payload.sheetName ?? null,
    };
    clientInvoiceCache.set(key, result);
    return result;
  })().finally(() => {
    inFlightLookups.delete(key);
  });

  inFlightLookups.set(key, promise);
  return promise;
}
