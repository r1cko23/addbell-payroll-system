"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BodySmall, Caption } from "@/components/ui/typography";
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
    if (!employeeId || !otDate) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        employee_id: employeeId,
        ot_date: otDate,
      });
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
      {!otDate ? (
        <Caption className="text-muted-foreground">
          Select an OT date first to link a clock in/out.
        </Caption>
      ) : loading ? (
        <Caption className="text-muted-foreground">Loading…</Caption>
      ) : error ? (
        <Caption className="text-destructive">{error}</Caption>
      ) : sessions.length === 0 ? (
        <Caption className="text-muted-foreground">
          No completed clock in/out on this date (or already linked to another
          OT). You can still file without a link.
        </Caption>
      ) : (
        <>
          <BodySmall className="text-muted-foreground">
            Completed clock in/out for the selected OT date. Does not set OT
            hours.
          </BodySmall>
          <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-input p-2">
            {sessions.map((s) => {
              const key = sessionPairKey(s.in_punch_id, s.out_punch_id);
              const checked = selectedKey === key;
              return (
                <label
                  key={key}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors active:bg-muted/50 ${
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border motion-safe:md:hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="bundy-session"
                    className="size-4 shrink-0"
                    checked={checked}
                    onChange={() =>
                      onChange({
                        in_punch_id: s.in_punch_id,
                        out_punch_id: s.out_punch_id,
                        session: s,
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 font-medium">
                    {format(new Date(s.clock_in_time), "MMM d, h:mm a")} –{" "}
                    {format(new Date(s.clock_out_time), "h:mm a")}
                    <span className="ml-2 font-normal text-muted-foreground">
                      ({s.total_hours.toFixed(2)}h shift)
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
