"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
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

function formatLocation(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "No GPS recorded";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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

  return (
    <div className="space-y-2 w-full">
      <Label>
        Bundy Time In / Out pair{required ? " *" : ""}
      </Label>
      <BodySmall className="text-muted-foreground">
        Choose a completed clock pair. Date and start/end will fill from this pair; you enter
        OT hours manually.
      </BodySmall>
      {loading ? (
        <Caption className="text-muted-foreground">Loading clock sessions…</Caption>
      ) : error ? (
        <Caption className="text-destructive">{error}</Caption>
      ) : sessions.length === 0 ? (
        <Caption className="text-muted-foreground">
          No completed Time In / Out pairs found
          {otDate ? ` for ${otDate}` : ""}. Clock in and out on Bundy first, then file OT.
        </Caption>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-input p-2">
          {sessions.map((s) => {
            const key = sessionPairKey(s.in_punch_id, s.out_punch_id);
            const checked = selectedKey === key;
            return (
              <label
                key={key}
                className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition-colors ${
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="bundy-session"
                  className="mt-1"
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
                      ({s.total_hours.toFixed(2)}h)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-start gap-1">
                    <Icon name="MapPin" size={IconSizes.xs} className="shrink-0 mt-0.5" />
                    <span>
                      In: {formatLocation(s.clock_in_lat, s.clock_in_lng)}
                      <br />
                      Out: {formatLocation(s.clock_out_lat, s.clock_out_lng)}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
