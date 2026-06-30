import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase free tier defaults (June 2026). */
export const PLATFORM_FREE_TIER_LIMITS = {
  supabaseStorageBytes: 1 * 1024 * 1024 * 1024,
  supabaseDatabaseBytes: 500 * 1024 * 1024,
  supabaseEgressBytes: 500 * 1024 * 1024,
  vercelBandwidthBytes: 100 * 1024 * 1024 * 1024,
} as const;

export type StorageModuleKey =
  | "fund_requests"
  | "overtime"
  | "leave"
  | "profile_pictures";

export type StorageLocation = "supabase_storage" | "database_base64" | "mixed";

export type StorageModuleSummary = {
  key: StorageModuleKey;
  label: string;
  fileCount: number;
  totalBytes: number;
  storageBytes: number;
  databaseBase64Bytes: number;
  legacyBase64Count: number;
  location: StorageLocation;
  notes: string[];
};

export type RecentUploadRow = {
  id: string;
  module: StorageModuleKey;
  moduleLabel: string;
  fileName: string;
  fileSize: number | null;
  storageLocation: "supabase_storage" | "database_base64";
  documentType: string | null;
  createdAt: string;
};

export type PlatformStorageMonitorSnapshot = {
  generatedAt: string;
  totals: {
    fileCount: number;
    storageBytes: number;
    databaseBase64Bytes: number;
    estimatedTotalBytes: number;
  };
  limits: typeof PLATFORM_FREE_TIER_LIMITS;
  usagePercent: {
    supabaseStorage: number;
    supabaseDatabaseBase64: number;
  };
  modules: StorageModuleSummary[];
  recentUploads: RecentUploadRow[];
  recommendations: string[];
};

type DocumentRow = {
  id: string;
  file_name: string | null;
  file_size: number | null;
  file_base64: string | null;
  storage_path?: string | null;
  document_type?: string | null;
  created_at: string;
};

function estimateBase64Bytes(base64: string | null | undefined): number {
  if (!base64?.trim()) return 0;
  const normalized = base64.includes(",") ? base64.split(",")[1]! : base64;
  return Math.floor((normalized.length * 3) / 4);
}

function resolveStoredBytes(row: Pick<DocumentRow, "file_size" | "file_base64">): number {
  if (typeof row.file_size === "number" && row.file_size > 0) {
    return row.file_size;
  }
  return estimateBase64Bytes(row.file_base64);
}

function summarizeDocumentRows(
  rows: DocumentRow[],
  options: {
    hasStoragePath?: boolean;
    defaultDocumentType?: string | null;
  } = {}
): Pick<
  StorageModuleSummary,
  "fileCount" | "totalBytes" | "storageBytes" | "databaseBase64Bytes" | "legacyBase64Count"
> {
  let storageBytes = 0;
  let databaseBase64Bytes = 0;
  let legacyBase64Count = 0;

  for (const row of rows) {
    const bytes = resolveStoredBytes(row);
    const inStorage = Boolean(options.hasStoragePath && row.storage_path?.trim());
    if (inStorage) {
      storageBytes += bytes;
    } else if (row.file_base64?.trim()) {
      databaseBase64Bytes += bytes;
      legacyBase64Count += 1;
    } else {
      storageBytes += bytes;
    }
  }

  return {
    fileCount: rows.length,
    totalBytes: storageBytes + databaseBase64Bytes,
    storageBytes,
    databaseBase64Bytes,
    legacyBase64Count,
  };
}

async function listBucketObjects(
  admin: SupabaseClient,
  bucket: string,
  prefix = ""
): Promise<Array<{ name: string; size: number }>> {
  const results: Array<{ name: string; size: number }> = [];
  const queue = [prefix];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentPrefix = queue.shift() ?? "";
    if (visited.has(currentPrefix)) continue;
    visited.add(currentPrefix);

    let offset = 0;
    const limit = 100;

    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(currentPrefix, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error || !data?.length) break;

      for (const entry of data) {
        const entryName = entry.name;
        if (!entryName) continue;

        const fullPath = currentPrefix ? `${currentPrefix}/${entryName}` : entryName;
        const metadata = entry.metadata as { size?: number } | null;
        const size = typeof metadata?.size === "number" ? metadata.size : 0;

        if (!entry.id && !metadata?.size) {
          queue.push(fullPath);
          continue;
        }

        results.push({ name: fullPath, size });
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  return results;
}

function buildRecommendations(snapshot: {
  totals: PlatformStorageMonitorSnapshot["totals"];
  modules: StorageModuleSummary[];
}): string[] {
  const recommendations: string[] = [];
  const storagePct =
    (snapshot.totals.storageBytes / PLATFORM_FREE_TIER_LIMITS.supabaseStorageBytes) * 100;
  const dbPct =
    (snapshot.totals.databaseBase64Bytes /
      PLATFORM_FREE_TIER_LIMITS.supabaseDatabaseBytes) *
    100;

  if (storagePct >= 80) {
    recommendations.push(
      "Supabase Storage is above 80% of the free 1 GB limit. Archive or delete old fund request attachments and unused profile photos."
    );
  }
  if (dbPct >= 50) {
    recommendations.push(
      "Database file storage (base64) is high. Leave and OT uploads still store files in Postgres — migrate them to Supabase Storage when possible."
    );
  }

  const legacyFund = snapshot.modules.find((m) => m.key === "fund_requests");
  if (legacyFund && legacyFund.legacyBase64Count > 0) {
    recommendations.push(
      `${legacyFund.legacyBase64Count} fund request file(s) still use legacy base64 in the database. Re-upload or migrate them to Storage to save DB space.`
    );
  }

  const ot = snapshot.modules.find((m) => m.key === "overtime");
  const leave = snapshot.modules.find((m) => m.key === "leave");
  if ((ot?.fileCount ?? 0) > 0 || (leave?.fileCount ?? 0) > 0) {
    recommendations.push(
      "Overtime and leave attachments count toward your 500 MB database quota because they are stored as base64. Keep files under 3 MB and delete test requests periodically."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Usage is within comfortable free-tier headroom. Fund request files upload to Storage; Google Sheets billing lookups are cached to reduce API calls."
    );
  }

  return recommendations;
}

export async function getPlatformStorageMonitorSnapshot(
  admin: SupabaseClient
): Promise<PlatformStorageMonitorSnapshot> {
  const [
    fundRequestDocsResult,
    overtimeDocsResult,
    leaveDocsResult,
    profileBucketObjects,
  ] = await Promise.all([
    admin
      .from("fund_request_documents")
      .select(
        "id, file_name, file_size, file_base64, storage_path, document_type, created_at"
      )
      .order("created_at", { ascending: false }),
    admin
      .from("overtime_documents")
      .select("id, file_name, file_size, file_base64, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("leave_request_documents")
      .select("id, file_name, file_size, file_base64, document_type, created_at")
      .order("created_at", { ascending: false }),
    listBucketObjects(admin, "profile-pictures").catch(() => []),
  ]);

  const fundRows = (fundRequestDocsResult.data ?? []) as DocumentRow[];
  const overtimeRows = (overtimeDocsResult.data ?? []) as DocumentRow[];
  const leaveRows = (leaveDocsResult.data ?? []) as DocumentRow[];

  const fundSummary = summarizeDocumentRows(fundRows, { hasStoragePath: true });
  const paymentCheckCount = fundRows.filter(
    (row) => row.document_type === "payment_check"
  ).length;
  const supportingCount = fundRows.length - paymentCheckCount;

  const overtimeSummary = summarizeDocumentRows(overtimeRows);
  const leaveSummary = summarizeDocumentRows(leaveRows);

  const profileBytes = profileBucketObjects.reduce((sum, item) => sum + item.size, 0);

  const modules: StorageModuleSummary[] = [
    {
      key: "fund_requests",
      label: "Fund requests",
      ...fundSummary,
      location:
        fundSummary.storageBytes > 0 && fundSummary.databaseBase64Bytes > 0
          ? "mixed"
          : fundSummary.storageBytes > 0
            ? "supabase_storage"
            : "database_base64",
      notes: [
        `${supportingCount} supporting document(s), ${paymentCheckCount} payment check(s).`,
        "New uploads go to Supabase Storage (up to 5 MB each).",
      ],
    },
    {
      key: "overtime",
      label: "Overtime requests",
      ...overtimeSummary,
      location: "database_base64",
      notes: ["Stored in Postgres as base64 (counts toward 500 MB database quota)."],
    },
    {
      key: "leave",
      label: "Leave requests",
      ...leaveSummary,
      location: "database_base64",
      notes: ["Stored in Postgres as base64 (counts toward 500 MB database quota)."],
    },
    {
      key: "profile_pictures",
      label: "Profile pictures",
      fileCount: profileBucketObjects.length,
      totalBytes: profileBytes,
      storageBytes: profileBytes,
      databaseBase64Bytes: 0,
      legacyBase64Count: 0,
      location: "supabase_storage",
      notes: ["Employee profile photos in the profile-pictures bucket."],
    },
  ];

  const totals = modules.reduce(
    (acc, module) => {
      acc.fileCount += module.fileCount;
      acc.storageBytes += module.storageBytes;
      acc.databaseBase64Bytes += module.databaseBase64Bytes;
      acc.estimatedTotalBytes += module.totalBytes;
      return acc;
    },
    {
      fileCount: 0,
      storageBytes: 0,
      databaseBase64Bytes: 0,
      estimatedTotalBytes: 0,
    }
  );

  const recentUploads: RecentUploadRow[] = [
    ...fundRows.map((row) => ({
      id: row.id,
      module: "fund_requests" as const,
      moduleLabel: "Fund request",
      fileName: row.file_name || "document",
      fileSize: resolveStoredBytes(row),
      storageLocation: row.storage_path?.trim()
        ? ("supabase_storage" as const)
        : ("database_base64" as const),
      documentType: row.document_type ?? null,
      createdAt: row.created_at,
    })),
    ...overtimeRows.map((row) => ({
      id: row.id,
      module: "overtime" as const,
      moduleLabel: "Overtime",
      fileName: row.file_name || "document",
      fileSize: resolveStoredBytes(row),
      storageLocation: "database_base64" as const,
      documentType: null,
      createdAt: row.created_at,
    })),
    ...leaveRows.map((row) => ({
      id: row.id,
      module: "leave" as const,
      moduleLabel: "Leave",
      fileName: row.file_name || "document",
      fileSize: resolveStoredBytes(row),
      storageLocation: "database_base64" as const,
      documentType: row.document_type ?? null,
      createdAt: row.created_at,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 25);

  const usagePercent = {
    supabaseStorage:
      (totals.storageBytes / PLATFORM_FREE_TIER_LIMITS.supabaseStorageBytes) * 100,
    supabaseDatabaseBase64:
      (totals.databaseBase64Bytes /
        PLATFORM_FREE_TIER_LIMITS.supabaseDatabaseBytes) *
      100,
  };

  return {
    generatedAt: new Date().toISOString(),
    totals,
    limits: PLATFORM_FREE_TIER_LIMITS,
    usagePercent,
    modules,
    recentUploads,
    recommendations: buildRecommendations({ totals, modules }),
  };
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatStoragePercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.min(999, Math.max(0, value)).toFixed(1)}%`;
}
