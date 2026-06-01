"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import type { BundyCompletedSession } from "@/lib/bundy-sessions";
import { sessionPairKey } from "@/lib/bundy-sessions";

export type BundySessionSelection = {
  in_punch_id: string;
  out_punch_id: string;
  session: BundyCompletedSession;
};

type Props = {
  employeeId: string;
  otDate?: string;
  value: BundySessionSelection | null;
  onChange: (value: BundySessionSelection | null) => void;
  required?: boolean;
};

function formatCoordinatesKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function BundySessionPicker({
  employeeId,
  otDate,
  value,
  onChange,
  required = false,
}: Props) {
  const [sessions, setSessions] = useState<BundyCompletedSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reverseGeocodeMap, setReverseGeocodeMap] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ employee_id: employeeId });
      if (otDate) params.set("ot_date", otDate);
      const res = await fetch(
        `/api/employee-portal/bundy-sessions?${params.toString()}`
      );
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error || "Failed to load clock sessions");
        setSessions([]);
      } else {
        setSessions(json.sessions || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, otDate]);

  const selectedKey = value
    ? sessionPairKey(value.in_punch_id, value.out_punch_id)
    : "";

  useEffect(() => {
    const coordinateKeys = new Set<string>();
    sessions.forEach((s) => {
      if (s.clock_in_lat != null && s.clock_in_lng != null) {
        coordinateKeys.add(formatCoordinatesKey(s.clock_in_lat, s.clock_in_lng));
      }
      if (s.clock_out_lat != null && s.clock_out_lng != null) {
        coordinateKeys.add(
          formatCoordinatesKey(s.clock_out_lat, s.clock_out_lng)
        );
      }
    });

    const unresolved = Array.from(coordinateKeys).filter(
      (k) => !reverseGeocodeMap[k]
    );
    if (unresolved.length === 0) return;

    let cancelled = false;
    const run = async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        unresolved.slice(0, 80).map(async (key) => {
          const [latStr, lngStr] = key.split(",");
          const lat = Number.parseFloat(latStr);
          const lng = Number.parseFloat(lngStr);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          try {
            const res = await fetch(
              `/api/geocode/reverse?lat=${encodeURIComponent(
                String(lat)
              )}&lng=${encodeURIComponent(String(lng))}`
            );
            const json = (await res.json()) as { address?: string | null };
            if (res.ok && json.address) {
              updates[key] = json.address;
            }
          } catch {
            // ignore
          }
        })
      );

      if (cancelled || Object.keys(updates).length === 0) return;
      setReverseGeocodeMap((prev) => ({ ...prev, ...updates }));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [sessions, reverseGeocodeMap]);

  const resolveAddressOrCoords = (lat: number | null, lng: number | null) => {
    if (lat == null || lng == null) return "No GPS recorded";
    const key = formatCoordinatesKey(lat, lng);
    return reverseGeocodeMap[key] || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center justify-between gap-2">
        <Label>
          Clock I/O (optional){required ? " *" : ""}
        </Label>
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 shrink-0 px-3 sm:min-h-9"
            onClick={() => onChange(null)}
          >
            Clear
          </Button>
        )}
      </div>
      {otDate ? (
        <BodySmall className="text-muted-foreground">
          For location reference only. Does not set OT hours.
        </BodySmall>
      ) : null}
      {!otDate ? null : loading ? (
        <Caption className="text-muted-foreground">Loading…</Caption>
      ) : error ? (
        <Caption className="text-destructive">{error}</Caption>
      ) : sessions.length === 0 ? (
        <Caption className="text-muted-foreground">
          {`No clock record for ${otDate}. OT may be filed without a link.`}
        </Caption>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-input p-2">
          {sessions.map((s) => {
            const key = sessionPairKey(s.in_punch_id, s.out_punch_id);
            const checked = selectedKey === key;
            return (
              <label
                key={key}
                className={`flex min-h-11 cursor-pointer gap-3 rounded-md border p-3 text-sm transition-colors active:bg-muted/50 ${
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border motion-safe:md:hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="bundy-session"
                  className="mt-1 size-4 shrink-0"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      in_punch_id: s.in_punch_id,
                      out_punch_id: s.out_punch_id,
                      session: s,
                    })
                  }
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-medium">
                    {format(new Date(s.clock_in_time), "MMM d, h:mm a")} –{" "}
                    {format(new Date(s.clock_out_time), "h:mm a")}
                    <span className="text-muted-foreground font-normal ml-2">
                      ({s.total_hours.toFixed(2)}h shift)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-start gap-1">
                    <Icon name="MapPin" size={IconSizes.xs} className="shrink-0 mt-0.5" />
                    <span>
                      In: {resolveAddressOrCoords(s.clock_in_lat, s.clock_in_lng)}
                      <br />
                      Out: {resolveAddressOrCoords(s.clock_out_lat, s.clock_out_lng)}
                    </span>
                  </div>
                  {(s.clock_in_lat != null &&
                    s.clock_in_lng != null &&
                    s.clock_out_lat != null &&
                    s.clock_out_lng != null) && (
                    <a
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      href={`https://www.google.com/maps?q=${s.clock_in_lat},${s.clock_in_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="MapPin" size={IconSizes.xs} />
                      View in Google Maps
                    </a>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
