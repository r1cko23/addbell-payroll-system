const startedAt = new Date().toISOString();

const metrics = {
  billingPoCacheHits: 0,
  billingPoCacheMisses: 0,
  billingSheetListCacheHits: 0,
  billingSheetListCacheMisses: 0,
  googleSpreadsheetMetadataCalls: 0,
  googleSpreadsheetBatchGetCalls: 0,
  googleSpreadsheetRangesRead: 0,
  billingLookupRequests: 0,
  fundRequestDirectUploads: 0,
  fundRequestDirectUploadBytes: 0,
};

export type PlatformRuntimeMetrics = typeof metrics & {
  startedAt: string;
};

export function getPlatformRuntimeMetrics(): PlatformRuntimeMetrics {
  return { ...metrics, startedAt };
}

export function recordBillingPoCacheHit(): void {
  metrics.billingPoCacheHits += 1;
}

export function recordBillingPoCacheMiss(): void {
  metrics.billingPoCacheMisses += 1;
}

export function recordBillingSheetListCacheHit(): void {
  metrics.billingSheetListCacheHits += 1;
}

export function recordBillingSheetListCacheMiss(): void {
  metrics.billingSheetListCacheMisses += 1;
}

export function recordGoogleSpreadsheetMetadataCall(): void {
  metrics.googleSpreadsheetMetadataCalls += 1;
}

export function recordGoogleSpreadsheetBatchGetCall(rangeCount: number): void {
  metrics.googleSpreadsheetBatchGetCalls += 1;
  metrics.googleSpreadsheetRangesRead += Math.max(0, rangeCount);
}

export function recordBillingLookupRequest(): void {
  metrics.billingLookupRequests += 1;
}

export function recordFundRequestDirectUpload(fileSize: number): void {
  metrics.fundRequestDirectUploads += 1;
  metrics.fundRequestDirectUploadBytes += Math.max(0, fileSize);
}
