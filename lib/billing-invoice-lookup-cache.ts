import type { BillingInvoiceLookupResult } from "@/lib/google-sheets-billing-invoice";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/** Free-tier friendly defaults: fewer Google Sheets API calls between cache refreshes. */
const DEFAULT_PO_LOOKUP_TTL_MS = 15 * 60 * 1000;
const DEFAULT_SHEET_LIST_TTL_MS = 60 * 60 * 1000;

const poLookupCache = new Map<string, CacheEntry<BillingInvoiceLookupResult>>();
let sheetTitlesCache: CacheEntry<string[]> | null = null;

function ttlMs(envValue: string | undefined, fallback: number): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeBillingPoKey(poNumber: string): string {
  return poNumber.trim().toUpperCase().replace(/\s+/g, " ");
}

export function getCachedBillingPoLookup(
  poNumber: string
): BillingInvoiceLookupResult | null {
  const key = normalizeBillingPoKey(poNumber);
  if (!key || key === "N/A") return null;

  const entry = poLookupCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    poLookupCache.delete(key);
    return null;
  }
  return entry.value;
}

export function getBillingInvoiceLookupCacheStats() {
  const now = Date.now();
  let activePoEntries = 0;
  for (const entry of poLookupCache.values()) {
    if (entry.expiresAt > now) activePoEntries += 1;
  }

  const poCacheTtlMinutes = Math.round(
    ttlMs(process.env.GOOGLE_SHEETS_PO_LOOKUP_CACHE_MS, DEFAULT_PO_LOOKUP_TTL_MS) /
      60000
  );
  const sheetListTtlMinutes = Math.round(
    ttlMs(
      process.env.GOOGLE_SHEETS_TAB_LIST_CACHE_MS,
      DEFAULT_SHEET_LIST_TTL_MS
    ) / 60000
  );

  return {
    poCacheEntries: activePoEntries,
    poCacheTtlMinutes,
    sheetListCached: Boolean(
      sheetTitlesCache && sheetTitlesCache.expiresAt > now
    ),
    sheetListCount: sheetTitlesCache?.value.length ?? 0,
    sheetListExpiresInMinutes: sheetTitlesCache
      ? Math.max(0, Math.round((sheetTitlesCache.expiresAt - now) / 60000))
      : 0,
    sheetListTtlMinutes,
  };
}

export function setCachedBillingPoLookup(
  poNumber: string,
  result: BillingInvoiceLookupResult
): void {
  const key = normalizeBillingPoKey(poNumber);
  if (!key || key === "N/A") return;

  poLookupCache.set(key, {
    value: result,
    expiresAt:
      Date.now() +
      ttlMs(process.env.GOOGLE_SHEETS_PO_LOOKUP_CACHE_MS, DEFAULT_PO_LOOKUP_TTL_MS),
  });
}

export function getCachedBillingSheetTitles(): string[] | null {
  if (!sheetTitlesCache) return null;
  if (sheetTitlesCache.expiresAt <= Date.now()) {
    sheetTitlesCache = null;
    return null;
  }
  return sheetTitlesCache.value;
}

export function setCachedBillingSheetTitles(titles: string[]): void {
  sheetTitlesCache = {
    value: titles,
    expiresAt:
      Date.now() +
      ttlMs(
        process.env.GOOGLE_SHEETS_TAB_LIST_CACHE_MS,
        DEFAULT_SHEET_LIST_TTL_MS
      ),
  };
}

export function clearBillingInvoiceLookupCaches(): void {
  poLookupCache.clear();
  sheetTitlesCache = null;
}
