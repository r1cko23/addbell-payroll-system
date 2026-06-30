"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowsClockwise, ChartBar, Cloud, HardDrives } from "phosphor-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BodySmall, Caption } from "@/components/ui/typography";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  formatStorageBytes,
  formatStoragePercent,
  type PlatformStorageMonitorSnapshot,
} from "@/lib/platform-storage-monitor";
import type {
  GooglePlatformMonitorSnapshot,
  VercelPlatformMonitorSnapshot,
} from "@/lib/platform-api-monitor";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

function UsageBar({
  label,
  usedBytes,
  limitBytes,
  percent,
  tone = "default",
}: {
  label: string;
  usedBytes: number;
  limitBytes: number;
  percent: number;
  tone?: "default" | "warning" | "danger";
}) {
  const barTone =
    tone === "danger" || percent >= 90
      ? "bg-destructive"
      : tone === "warning" || percent >= 75
        ? "bg-amber-500"
        : "bg-primary";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatStorageBytes(usedBytes)} / {formatStorageBytes(limitBytes)} (
          {formatStoragePercent(percent)})
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barTone)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

function locationBadge(location: string) {
  if (location === "supabase_storage") {
    return <Badge variant="outline">Supabase Storage</Badge>;
  }
  if (location === "database_base64") {
    return <Badge variant="secondary">Database (base64)</Badge>;
  }
  return <Badge variant="outline">Mixed</Badge>;
}

type MonitorSnapshot = PlatformStorageMonitorSnapshot & {
  google: GooglePlatformMonitorSnapshot;
  vercel: VercelPlatformMonitorSnapshot;
};

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export default function AdminStorageMonitorPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/storage-monitor");
      const payload = (await response.json()) as MonitorSnapshot & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load storage monitor");
      }
      setSnapshot(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load storage monitor");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }
    void loadSnapshot();
  }, [isAdmin, roleLoading, loadSnapshot, router]);

  if (roleLoading || (!isAdmin && !error)) {
    return (
      <DashboardLayout>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Storage Monitor"
          description="Supabase file usage plus Google Sheets API and Vercel free-tier signals for fund requests, OT, and leave uploads."
          actions={
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void loadSnapshot()}
              disabled={loading}
            >
              <ArrowsClockwise className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        {error ? (
          <Card className="border-destructive/30">
            <CardContent className="py-6">
              <BodySmall className="text-destructive">{error}</BodySmall>
            </CardContent>
          </Card>
        ) : null}

        {snapshot ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total files"
                value={snapshot.totals.fileCount}
                meta="Across all request modules"
                icon={<HardDrives className="h-4 w-4" />}
              />
              <MetricCard
                label="Supabase Storage"
                value={formatStorageBytes(snapshot.totals.storageBytes)}
                meta={`${formatStoragePercent(snapshot.usagePercent.supabaseStorage)} of 1 GB free tier`}
              />
              <MetricCard
                label="Database file data"
                value={formatStorageBytes(snapshot.totals.databaseBase64Bytes)}
                meta={`${formatStoragePercent(snapshot.usagePercent.supabaseDatabaseBase64)} of 500 MB DB quota`}
              />
              <MetricCard
                label="Last refreshed"
                value={format(new Date(snapshot.generatedAt), "MMM d, h:mm a")}
                meta="Admin-only snapshot"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Free tier usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <UsageBar
                  label="Supabase Storage (files)"
                  usedBytes={snapshot.totals.storageBytes}
                  limitBytes={snapshot.limits.supabaseStorageBytes}
                  percent={snapshot.usagePercent.supabaseStorage}
                />
                <UsageBar
                  label="Database base64 attachments (OT, leave, legacy fund files)"
                  usedBytes={snapshot.totals.databaseBase64Bytes}
                  limitBytes={snapshot.limits.supabaseDatabaseBytes}
                  percent={snapshot.usagePercent.supabaseDatabaseBase64}
                />
                <Caption className="block">
                  Egress (downloads) shares the same 500 MB/month Supabase free quota and is not
                  measured here. Vercel Hobby includes 100 GB bandwidth/month for app traffic.
                </Caption>
              </CardContent>
            </Card>

            <div className="grid gap-3 xl:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ChartBar className="h-4 w-4" />
                    Google Sheets API
                  </CardTitle>
                  <Badge variant={snapshot.google.configured ? "outline" : "secondary"}>
                    {snapshot.google.configured ? "Configured" : "Not configured"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {snapshot.google.configured ? (
                    <div className="space-y-2">
                      <StatRow
                        label="Spreadsheet"
                        value={snapshot.google.spreadsheetIdMasked ?? "—"}
                      />
                      <StatRow
                        label="Service account"
                        value={
                          <span className="max-w-[14rem] truncate text-right text-xs font-normal">
                            {snapshot.google.serviceAccountEmail ?? "—"}
                          </span>
                        }
                      />
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-border/80 bg-muted/15 p-3 space-y-2">
                    <BodySmall className="font-medium text-foreground">Server cache (this instance)</BodySmall>
                    <StatRow
                      label="P.O. cache entries"
                      value={snapshot.google.cache.poCacheEntries}
                    />
                    <StatRow
                      label="P.O. cache TTL"
                      value={`${snapshot.google.cache.poCacheTtlMinutes} min`}
                    />
                    <StatRow
                      label="Invoice tab list"
                      value={
                        snapshot.google.cache.sheetListCached
                          ? `${snapshot.google.cache.sheetListCount} tabs (${snapshot.google.cache.sheetListExpiresInMinutes} min left)`
                          : "Not cached"
                      }
                    />
                    <StatRow
                      label="Cache hits / misses"
                      value={`${snapshot.google.runtime.billingPoCacheHits} / ${snapshot.google.runtime.billingPoCacheMisses}`}
                    />
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/15 p-3 space-y-2">
                    <BodySmall className="font-medium text-foreground">Google API calls (this instance)</BodySmall>
                    <StatRow
                      label="Billing lookup requests"
                      value={snapshot.google.runtime.billingLookupRequests}
                    />
                    <StatRow
                      label="Spreadsheet metadata reads"
                      value={snapshot.google.runtime.googleSpreadsheetMetadataCalls}
                    />
                    <StatRow
                      label="Batch value reads"
                      value={snapshot.google.runtime.googleSpreadsheetBatchGetCalls}
                    />
                    <StatRow
                      label="Sheet ranges read"
                      value={snapshot.google.runtime.googleSpreadsheetRangesRead}
                    />
                    <StatRow
                      label="Est. calls saved by cache"
                      value={snapshot.google.estimatedApiCallsSaved}
                    />
                  </div>

                  <Caption>
                    Free quota: ~{snapshot.google.limits.readRequestsPerMinute} read requests/min
                    per Google Cloud project.
                  </Caption>
                  <ul className="space-y-1">
                    {snapshot.google.notes.map((note) => (
                      <li key={note}>
                        <Caption>{note}</Caption>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Cloud className="h-4 w-4" />
                    Vercel (Hobby)
                  </CardTitle>
                  <Badge variant="outline">
                    {snapshot.vercel.runningOnVercel
                      ? snapshot.vercel.environment ?? "production"
                      : "local dev"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {snapshot.vercel.region ? (
                      <StatRow label="Region" value={snapshot.vercel.region} />
                    ) : null}
                    <StatRow
                      label="Bandwidth limit"
                      value={formatStorageBytes(snapshot.vercel.limits.bandwidthBytes)}
                    />
                    <StatRow
                      label="Max API body size"
                      value={formatStorageBytes(snapshot.vercel.limits.maxRequestBodyBytes)}
                    />
                    <StatRow
                      label="Serverless max duration"
                      value={`${snapshot.vercel.limits.serverlessMaxDurationSeconds}s`}
                    />
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/15 p-3 space-y-2">
                    <BodySmall className="font-medium text-foreground">
                      Bandwidth saved this instance
                    </BodySmall>
                    <StatRow
                      label="Direct fund uploads"
                      value={snapshot.vercel.runtime.fundRequestDirectUploads}
                    />
                    <StatRow
                      label="Bytes bypassing Vercel"
                      value={formatStorageBytes(snapshot.vercel.estimatedBandwidthSavedBytes)}
                    />
                    <StatRow
                      label="Metrics since"
                      value={format(new Date(snapshot.vercel.runtime.startedAt), "MMM d, h:mm a")}
                    />
                  </div>

                  <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                    <a href={snapshot.vercel.dashboardUrl} target="_blank" rel="noreferrer">
                      Open Vercel usage dashboard
                    </a>
                  </Button>

                  <ul className="space-y-1">
                    {snapshot.vercel.notes.map((note) => (
                      <li key={note}>
                        <Caption>{note}</Caption>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By module</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {snapshot.modules.map((module) => (
                  <div
                    key={module.key}
                    className="rounded-lg border border-border/80 bg-muted/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{module.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {module.fileCount} file(s) · {formatStorageBytes(module.totalBytes)} total
                        </p>
                      </div>
                      {locationBadge(module.location)}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Storage: </span>
                        <span className="font-medium tabular-nums">
                          {formatStorageBytes(module.storageBytes)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Database: </span>
                        <span className="font-medium tabular-nums">
                          {formatStorageBytes(module.databaseBase64Bytes)}
                        </span>
                      </div>
                    </div>
                    {module.legacyBase64Count > 0 ? (
                      <BodySmall className="mt-2 text-amber-900">
                        {module.legacyBase64Count} legacy base64 file(s) still in Postgres.
                      </BodySmall>
                    ) : null}
                    <ul className="mt-2 space-y-1">
                      {module.notes.map((note) => (
                        <li key={note}>
                          <Caption>{note}</Caption>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {snapshot.recommendations.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent uploads</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">When</th>
                      <th className="py-2 pr-3 font-medium">Module</th>
                      <th className="py-2 pr-3 font-medium">File</th>
                      <th className="py-2 pr-3 font-medium">Size</th>
                      <th className="py-2 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.recentUploads.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-muted-foreground">
                          No uploaded files yet.
                        </td>
                      </tr>
                    ) : (
                      snapshot.recentUploads.map((row) => (
                        <tr key={`${row.module}-${row.id}`} className="border-b border-border/60">
                          <td className="py-3 pr-3 whitespace-nowrap tabular-nums">
                            {format(new Date(row.createdAt), "MMM d, yyyy h:mm a")}
                          </td>
                          <td className="py-3 pr-3">
                            <div>{row.moduleLabel}</div>
                            {row.documentType ? (
                              <Caption className="capitalize">
                                {row.documentType.replace(/_/g, " ")}
                              </Caption>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 max-w-[16rem] truncate">{row.fileName}</td>
                          <td className="py-3 pr-3 tabular-nums">
                            {row.fileSize != null ? formatStorageBytes(row.fileSize) : "—"}
                          </td>
                          <td className="py-3">
                            {row.storageLocation === "supabase_storage" ? (
                              <Badge variant="outline">Storage</Badge>
                            ) : (
                              <Badge variant="secondary">Database</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
