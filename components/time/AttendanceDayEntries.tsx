"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  attendanceEntryHoursLabel,
  attendanceEntrySourceLabel,
  attendanceEntryStatusLabel,
  attendanceEntryStatusTone,
} from "@/lib/attendance-entry-display";
import {
  resolveLocationDetails,
  type OfficeLocation,
} from "@/lib/location";

export type AttendanceDayPunch = {
  id: string;
  clockInTime: string;
  clockOutTime: string | null;
  status: string;
  regularHours?: number | null;
  totalHours?: number | null;
  clockInDevice?: string | null;
  clockInLocation?: string | null;
  clockOutLocation?: string | null;
  source?: string | null;
};

function placeLabel(location: string | null | undefined, offices: OfficeLocation[]) {
  const details = resolveLocationDetails(location ?? null, offices);
  if (!details.coordinates && (!details.name || details.name === "No GPS data")) {
    return null;
  }
  if (details.address && details.address !== details.name) {
    return `${details.name} · ${details.address}`;
  }
  return details.name || null;
}

export function AttendanceDayEntries({
  punches,
  officeLocations = [],
}: {
  punches: AttendanceDayPunch[];
  officeLocations?: OfficeLocation[];
}) {
  if (punches.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <ul className="min-w-[16rem] max-w-md space-y-3 text-left">
      {punches.map((punch) => {
        const statusLabel = attendanceEntryStatusLabel({
          status: punch.status,
          clockOutTime: punch.clockOutTime,
        });
        const hours = attendanceEntryHoursLabel({
          totalHours: punch.totalHours ?? null,
          regularHours: punch.regularHours ?? null,
        });
        const source = attendanceEntrySourceLabel({
          source: punch.source,
          device: punch.clockInDevice,
        });
        const place = placeLabel(punch.clockInLocation, officeLocations);

        return (
          <li key={punch.id} className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-medium tabular-nums tracking-tight">
                {format(new Date(punch.clockInTime), "h:mm a")}
                <span className="mx-1 text-muted-foreground">–</span>
                {punch.clockOutTime
                  ? format(new Date(punch.clockOutTime), "h:mm a")
                  : "open"}
              </p>
              <span
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${attendanceEntryStatusTone(statusLabel)}`}
              >
                {statusLabel}
              </span>
              {hours ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {hours}
                </span>
              ) : null}
              {source ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                  {source}
                </Badge>
              ) : null}
            </div>
            {place ? (
              <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground" title={place}>
                {place}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
