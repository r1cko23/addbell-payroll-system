"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatPHTime } from "@/utils/format";
import { creditOvertimeHours, OT_MIN_HOURS } from "@/utils/overtime";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BodySmall, Caption, H1, H3 } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import {
  BundySessionPicker,
  type BundySessionSelection,
} from "@/components/BundySessionPicker";
import {
  manilaDateFromIso,
  manilaTimeFromIso,
} from "@/lib/bundy-sessions";
import { computeRawOtSpanHours } from "@/lib/ot-claimed-range";

type OvertimeDocSummary = { id: string; file_name: string };

type OvertimeRequest = {
  id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  project_manager_id?: string | null;
  account_manager_id?: string | null;
  project_manager_approved_at?: string | null;
  approved_by?: string | null;
  hr_approved_by?: string | null;
  approved_at?: string | null;
  manager_approval_name?: string | null;
  final_approval_name?: string | null;
  created_at: string;
  overtime_documents?: OvertimeDocSummary[];
  bundy_in_punch_id?: string | null;
  bundy_out_punch_id?: string | null;
  bundy_session?: {
    clock_in_time: string;
    clock_out_time: string;
    clock_in_lat: number | null;
    clock_in_lng: number | null;
    clock_out_lat: number | null;
    clock_out_lng: number | null;
  } | null;
};

function formatTime12h(value?: string | null): string {
  if (!value) return "—";
  const raw = value.includes("T")
    ? value.split("T")[1]?.split(".")[0] || value
    : value;
  const [h, m] = raw.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function OvertimePage() {
  const { employee } = useEmployeeSession();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ot_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    claimed_hours: "",
    reason: "",
  });
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [replaceDocByRequestId, setReplaceDocByRequestId] = useState<
    Record<string, File | null>
  >({});
  const [replaceDocLoadingId, setReplaceDocLoadingId] = useState<string | null>(
    null
  );
  const [requiresOtPunch, setRequiresOtPunch] = useState(false);
  const [bundySelection, setBundySelection] =
    useState<BundySessionSelection | null>(null);
  const [bundyInAddress, setBundyInAddress] = useState<string>("");
  const [bundyOutAddress, setBundyOutAddress] = useState<string>("");
  const [bundyAddressLoading, setBundyAddressLoading] = useState(false);
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const statusStyles: Record<OvertimeRequest["status"], string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-600 text-white border-emerald-600",
    rejected: "bg-rose-100 text-rose-900 border-rose-200",
  };
  const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
  const isManagerApproved = (request: OvertimeRequest) =>
    request.status === "pending" &&
    Boolean(request.project_manager_id || request.account_manager_id);

  const approvedCount = requests.filter(
    (r) => r.status === "approved" || isManagerApproved(r)
  ).length;

  const resolveMimeType = (file: File) => {
    if (file.type) return file.type;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".docx"))
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".doc")) return "application/msword";
    return "application/octet-stream";
  };

  const isAllowedFile = (file: File) => {
    const typeOk = ALLOWED_TYPES.includes(resolveMimeType(file));
    const extOk = ALLOWED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    return typeOk || extOk;
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        if (base64) resolve(base64);
        else reject(new Error("Unable to read file"));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const useBundyLinkedHours = requiresOtPunch || Boolean(bundySelection);

  const rawHoursFromTimeRange = useMemo(() => {
    if (!formData.start_time || !formData.end_time || !formData.ot_date) return 0;
    let calculatedEndDate: string | null = formData.end_date || null;
    if (!calculatedEndDate) {
      const startTimeOnly = new Date(`2000-01-01T${formData.start_time}:00`);
      const endTimeOnly = new Date(`2000-01-01T${formData.end_time}:00`);
      if (endTimeOnly.getTime() <= startTimeOnly.getTime()) {
        const endDateObj = new Date(formData.ot_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        calculatedEndDate = endDateObj.toISOString().split("T")[0];
      }
    }
    return (
      computeRawOtSpanHours({
        otDate: formData.ot_date,
        endDate: calculatedEndDate,
        startTime: formData.start_time,
        endTime: formData.end_time,
      }) ?? 0
    );
  }, [
    formData.start_time,
    formData.end_time,
    formData.ot_date,
    formData.end_date,
  ]);

  const hoursFromTimeRange = useMemo(() => {
    if (rawHoursFromTimeRange <= 0) return 0;
    return creditOvertimeHours(rawHoursFromTimeRange);
  }, [rawHoursFromTimeRange]);

  const manualClaimedHours = useMemo(() => {
    const raw = Number(formData.claimed_hours);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return creditOvertimeHours(raw);
  }, [formData.claimed_hours]);

  const submittedHours = useBundyLinkedHours ? manualClaimedHours : hoursFromTimeRange;
  const exceedsClaimedTimeRange =
    useBundyLinkedHours &&
    Number(formData.claimed_hours) > 0 &&
    rawHoursFromTimeRange > 0 &&
    Number(formData.claimed_hours) > rawHoursFromTimeRange + 1e-9;
  const spanTooShortForOt =
    useBundyLinkedHours &&
    rawHoursFromTimeRange > 0 &&
    rawHoursFromTimeRange < OT_MIN_HOURS;

  const loadRequests = async () => {
    setLoading(true);
    const response = await fetch(
      `/api/employee-portal/overtime-requests?employee_id=${encodeURIComponent(
        employee.id
      )}`
    );
    const payload = await response.json();

    if (!response.ok) {
      console.error("Error loading OT requests", payload);
      toast.error("Failed to load OT requests");
      setLoading(false);
      return;
    }

    setRequests((payload.requests || []) as OvertimeRequest[]);
    setLoading(false);
  };

  const loadProfile = async () => {
    const res = await fetch(
      `/api/employee-portal/employee-profile?employee_id=${encodeURIComponent(
        employee.id
      )}`
    );
    const json = (await res.json().catch(() => ({}))) as {
      requires_ot_punch?: boolean;
    };
    if (res.ok) {
      setRequiresOtPunch(json.requires_ot_punch === true);
    }
  };

  useEffect(() => {
    loadRequests();
    loadProfile();
  }, [employee.id]);

  useEffect(() => {
    if (!bundySelection) {
      setBundyInAddress("");
      setBundyOutAddress("");
      setBundyAddressLoading(false);
      return;
    }

    const inLat = bundySelection.session.clock_in_lat;
    const inLng = bundySelection.session.clock_in_lng;
    const outLat = bundySelection.session.clock_out_lat;
    const outLng = bundySelection.session.clock_out_lng;

    if (inLat == null || inLng == null) setBundyInAddress("No GPS recorded");
    if (outLat == null || outLng == null) setBundyOutAddress("No GPS recorded");

    let cancelled = false;
    const resolve = async (lat: number, lng: number) => {
      const res = await fetch(
        `/api/geocode/reverse?lat=${encodeURIComponent(
          String(lat)
        )}&lng=${encodeURIComponent(String(lng))}`
      );
      const json = (await res.json().catch(() => ({}))) as {
        address?: string | null;
      };
      if (!res.ok) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      return json.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    };

    (async () => {
      setBundyAddressLoading(true);
      try {
        const [inAddr, outAddr] = await Promise.all([
          inLat != null && inLng != null ? resolve(inLat, inLng) : null,
          outLat != null && outLng != null ? resolve(outLat, outLng) : null,
        ]);
        if (cancelled) return;
        if (inAddr) setBundyInAddress(inAddr);
        if (outAddr) setBundyOutAddress(outAddr);
      } finally {
        if (!cancelled) setBundyAddressLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bundySelection]);

  const applyBundySelectionToForm = (sel: BundySessionSelection | null) => {
    setBundySelection(sel);
    if (!sel) return;
    const otDate = manilaDateFromIso(sel.session.clock_in_time);
    const clockOutDate = manilaDateFromIso(sel.session.clock_out_time);
    setFormData((prev) => ({
      ...prev,
      ot_date: otDate,
      end_date: clockOutDate !== otDate ? clockOutDate : "",
      start_time: manilaTimeFromIso(sel.session.clock_in_time),
      end_time: manilaTimeFromIso(sel.session.clock_out_time),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requiresOtPunch && !bundySelection) {
      toast.error("Select a Bundy pair.");
      return;
    }

    if (!formData.ot_date || !formData.start_time || !formData.end_time) {
      toast.error("Enter OT date, start, and end.");
      return;
    }
    if (useBundyLinkedHours) {
      if (!formData.claimed_hours.trim()) {
        toast.error("Enter how many OT hours you actually worked.");
        return;
      }
      if (manualClaimedHours <= 0) {
        toast.error(
          `Minimum OT credit is ${OT_MIN_HOURS} hour (half-hour steps after that).`
        );
        return;
      }
      if (exceedsClaimedTimeRange) {
        toast.error(
          `Claimed OT hours cannot exceed the time range (${rawHoursFromTimeRange.toFixed(
            2
          )}h).`
        );
        return;
      }
      if (spanTooShortForOt) {
        toast.error(
          `Claimed OT time range must be at least ${OT_MIN_HOURS} hour.`
        );
        return;
      }
    } else if (hoursFromTimeRange <= 0) {
      toast.error("Invalid time range. Check your OT start and end times.");
      return;
    }
    if (!formData.reason.trim()) {
      toast.error("Add a reason.");
      return;
    }

    if (supportingDoc) {
      if (!isAllowedFile(supportingDoc)) {
        toast.error("Only PDF, DOC, or DOCX files are allowed.");
        return;
      }
      if (supportingDoc.size > MAX_FILE_SIZE) {
        toast.error("File too large. Max size is 5MB.");
        return;
      }
    }

    // Auto-calculate end_date if not provided but spans midnight
    let calculatedEndDate: string | null = null;
    if (!formData.end_date) {
      const startTimeOnly = new Date(`2000-01-01T${formData.start_time}:00`);
      const endTimeOnly = new Date(`2000-01-01T${formData.end_time}:00`);
      if (endTimeOnly.getTime() <= startTimeOnly.getTime()) {
        // Spans midnight - calculate end_date as ot_date + 1 day
        const endDateObj = new Date(formData.ot_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        calculatedEndDate = endDateObj.toISOString().split("T")[0];
      }
    }

    setSubmitting(true);
    setDocError(null);

    let documentPayload:
      | {
          file_name: string;
          file_type: string;
          file_size: number;
          file_base64: string;
        }
      | null = null;
    if (supportingDoc) {
      const base64 = await fileToBase64(supportingDoc);
      documentPayload = {
        file_name: supportingDoc.name,
        file_type: resolveMimeType(supportingDoc),
        file_size: supportingDoc.size,
        file_base64: base64,
      };
    }

    const createResponse = await fetch("/api/employee-portal/overtime-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employee.id,
        ot_date: formData.ot_date,
        end_date: formData.end_date || calculatedEndDate || null,
        start_time: formData.start_time,
        end_time: formData.end_time,
        total_hours: submittedHours,
        reason: formData.reason.trim(),
        bundy_in_punch_id: bundySelection?.in_punch_id ?? null,
        bundy_out_punch_id: bundySelection?.out_punch_id ?? null,
        document: documentPayload,
      }),
    });
    const createPayload = await createResponse.json();

    if (!createResponse.ok) {
      console.error("Error filing OT", createPayload);
      toast.error(createPayload?.error || "Failed to submit OT request");
    } else {
      // Determine if OT spans midnight
      const startTimeOnly = new Date(`2000-01-01T${formData.start_time}:00`);
      const endTimeOnly = new Date(`2000-01-01T${formData.end_time}:00`);
      const spansMidnight = endTimeOnly.getTime() <= startTimeOnly.getTime();
      const actualEndDate =
        formData.end_date ||
        (spansMidnight
          ? (() => {
              const d = new Date(formData.ot_date);
              d.setDate(d.getDate() + 1);
              return d.toISOString().split("T")[0];
            })()
          : formData.ot_date);

      const dateRange =
        spansMidnight ||
        (formData.end_date && formData.end_date !== formData.ot_date)
          ? `${formatPHTime(
              new Date(formData.ot_date),
              "MMM d"
            )} - ${formatPHTime(new Date(actualEndDate), "MMM d, yyyy")}`
          : formatPHTime(new Date(formData.ot_date), "MMM d, yyyy");

      if (createPayload?.warning) {
        toast.warning(createPayload.warning, {
          description: `Date: ${dateRange} • ${submittedHours.toFixed(2)} hours`,
        });
      } else {
        toast.success("Overtime request submitted successfully!", {
          description: `Date: ${dateRange} • ${submittedHours.toFixed(2)} hours`,
        });
      }
      setFormData({
        ot_date: "",
        end_date: "",
        start_time: "",
        end_time: "",
        claimed_hours: "",
        reason: "",
      });
      setBundySelection(null);
      setSupportingDoc(null);
      await loadRequests();
    }
    setSubmitting(false);
  };

  return (
    <VStack gap="6" className="w-full">
      <VStack gap="2" align="start">
        <H1>OT filing</H1>
        <BodySmall className="text-muted-foreground">
          File an overtime request for approval.
        </BodySmall>
      </VStack>
      {/* Request Form */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle>
            <HStack gap="2" align="center">
              <Icon name="ClockClockwise" size={IconSizes.md} />
              OT Filing
            </HStack>
          </CardTitle>
          <BodySmall className="text-muted-foreground">
            Add details and submit.
          </BodySmall>
          {requiresOtPunch && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              Select a Bundy pair to auto-fill date and time.
            </div>
          )}
        </CardHeader>
        <CardContent className="w-full">
          <form onSubmit={handleSubmit} className="w-full">
            <VStack gap="6" className="w-full">
              <BundySessionPicker
                employeeId={employee.id}
                otDate={formData.ot_date || undefined}
                value={bundySelection}
                onChange={applyBundySelectionToForm}
                required={requiresOtPunch}
              />

              {bundySelection && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Bundy span:{" "}
                  <strong>{bundySelection.session.total_hours.toFixed(2)}h</strong>.
                </div>
              )}

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundySelection && (
                  <>
                    <div className="w-full space-y-2">
                      <Label>Time In location</Label>
                      <Input
                        value={
                          bundyAddressLoading && !bundyInAddress
                            ? "Resolving address…"
                            : bundyInAddress ||
                              (bundySelection.session.clock_in_lat != null &&
                              bundySelection.session.clock_in_lng != null
                                ? `${bundySelection.session.clock_in_lat.toFixed(
                                    6
                                  )}, ${bundySelection.session.clock_in_lng.toFixed(6)}`
                                : "No GPS recorded")
                        }
                        readOnly
                        className="bg-muted/70"
                      />
                      {bundySelection.session.clock_in_lat != null &&
                        bundySelection.session.clock_in_lng != null && (
                          <a
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            href={`https://www.google.com/maps?q=${bundySelection.session.clock_in_lat},${bundySelection.session.clock_in_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Icon name="MapPin" size={IconSizes.xs} />
                            View in Google Maps
                          </a>
                        )}
                    </div>
                    <div className="w-full space-y-2">
                      <Label>Time Out location</Label>
                      <Input
                        value={
                          bundyAddressLoading && !bundyOutAddress
                            ? "Resolving address…"
                            : bundyOutAddress ||
                              (bundySelection.session.clock_out_lat != null &&
                              bundySelection.session.clock_out_lng != null
                                ? `${bundySelection.session.clock_out_lat.toFixed(
                                    6
                                  )}, ${bundySelection.session.clock_out_lng.toFixed(6)}`
                                : "No GPS recorded")
                        }
                        readOnly
                        className="bg-muted/70"
                      />
                      {bundySelection.session.clock_out_lat != null &&
                        bundySelection.session.clock_out_lng != null && (
                          <a
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            href={`https://www.google.com/maps?q=${bundySelection.session.clock_out_lat},${bundySelection.session.clock_out_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Icon name="MapPin" size={IconSizes.xs} />
                            View in Google Maps
                          </a>
                        )}
                    </div>
                  </>
                )}
                <div className="w-full space-y-2">
                  <Label htmlFor="ot-date">Claimed OT date</Label>
                  <Input
                    id="ot-date"
                    type="date"
                    required
                    readOnly={Boolean(bundySelection)}
                    className={bundySelection ? "bg-muted/70" : undefined}
                    value={formData.ot_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ot_date: e.target.value }))
                    }
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="start-time">Claimed OT start</Label>
                  <Input
                    id="start-time"
                    type="time"
                    required
                    readOnly={Boolean(bundySelection)}
                    className={bundySelection ? "bg-muted/70" : undefined}
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_time: e.target.value }))
                    }
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="end-time">Claimed OT end</Label>
                  <Input
                    id="end-time"
                    type="time"
                    required
                    readOnly={Boolean(bundySelection)}
                    className={bundySelection ? "bg-muted/70" : undefined}
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, end_time: e.target.value }))
                    }
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="claimed-hours">Claimed OT hours *</Label>
                  {useBundyLinkedHours ? (
                    <>
                      <Input
                        id="claimed-hours"
                        type="number"
                        inputMode="decimal"
                        min={OT_MIN_HOURS}
                        max={
                          rawHoursFromTimeRange >= OT_MIN_HOURS
                            ? rawHoursFromTimeRange
                            : undefined
                        }
                        step={0.5}
                        required
                        placeholder="e.g. 2"
                        value={formData.claimed_hours}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            claimed_hours: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Hours worked (min {OT_MIN_HOURS}h, 0.5h steps).
                      </p>
                      {spanTooShortForOt && (
                        <p className="text-xs font-medium text-destructive">
                          Time range is below the {OT_MIN_HOURS}h minimum for OT.
                        </p>
                      )}
                      {exceedsClaimedTimeRange && (
                        <p className="text-xs font-medium text-destructive">
                          Max {rawHoursFromTimeRange.toFixed(2)}h for this time range.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Input
                        id="claimed-hours"
                        value={
                          hoursFromTimeRange > 0
                            ? hoursFromTimeRange.toFixed(2)
                            : ""
                        }
                        readOnly
                        className="bg-muted/70"
                      />
                      <p className="text-xs text-muted-foreground">
                        Computed from claimed start/end above.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Optional end date for multi-day OT */}
              {!bundySelection &&
              (() => {
                const startTimeOnly = new Date(
                  `2000-01-01T${formData.start_time}:00`
                );
                const endTimeOnly = new Date(
                  `2000-01-01T${formData.end_time}:00`
                );
                const autoSpansMidnight =
                  formData.start_time &&
                  formData.end_time &&
                  endTimeOnly.getTime() <= startTimeOnly.getTime();

                return (
                  <div className="w-full space-y-2">
                    <Label htmlFor="end-date">
                      End Date {autoSpansMidnight && "(auto-calculated)"}
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={formData.end_date}
                      min={formData.ot_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {autoSpansMidnight
                        ? "Auto-set to next day."
                        : "Only needed if OT spans multiple days."}
                    </p>
                  </div>
                );
              })()}

              {bundySelection && formData.end_date && (
                <p className="text-xs text-muted-foreground">
                  End date: {formData.end_date} (from clock out)
                </p>
              )}

              {submittedHours > 0 && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="text-sm font-semibold text-primary">
                    Hours you are claiming:{" "}
                    <span className="text-lg">{submittedHours.toFixed(2)}</span>
                    {bundySelection &&
                      Math.abs(
                        submittedHours - bundySelection.session.total_hours
                      ) > 0.25 && (
                        <span className="block text-xs font-normal text-muted-foreground mt-1">
                          Bundy span: {bundySelection.session.total_hours.toFixed(2)}h
                        </span>
                      )}
                  </div>
                </div>
              )}

              <div className="w-full space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  rows={4}
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Reason for OT"
                />
              </div>

              <div className="w-full space-y-2">
                <Label htmlFor="ot-doc">Attachment (optional)</Label>
                <input
                  id="ot-doc"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setSupportingDoc(null);
                      setDocError(null);
                      return;
                    }
                    if (!isAllowedFile(file)) {
                      setDocError("Only PDF, DOC, or DOCX files are allowed.");
                      setSupportingDoc(null);
                      return;
                    }
                    if (file.size > MAX_FILE_SIZE) {
                      setDocError("File too large. Max size is 5MB.");
                      setSupportingDoc(null);
                      return;
                    }
                    setDocError(null);
                    setSupportingDoc(file);
                  }}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
                <p className="text-xs text-muted-foreground">PDF, DOC, or DOCX. Max 5MB.</p>
                {supportingDoc && !docError && (
                  <HStack
                    gap="2"
                    align="center"
                    className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary"
                  >
                    <Icon name="Paperclip" size={IconSizes.sm} />
                    <span>{supportingDoc.name}</span>
                    <Caption>
                      {(supportingDoc.size / 1024 / 1024).toFixed(2)} MB
                    </Caption>
                  </HStack>
                )}
                {docError && (
                  <p className="text-sm text-destructive font-medium">
                    {docError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={
                  submitting ||
                  !formData.ot_date ||
                  !formData.start_time ||
                  !formData.end_time ||
                  !formData.reason.trim() ||
                  exceedsClaimedTimeRange ||
                  spanTooShortForOt
                }
                className="w-full md:w-auto md:min-w-[200px] text-sm md:text-base px-3 md:px-4 py-3 md:py-4 min-h-[48px] md:min-h-[56px]"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRight" size={IconSizes.sm} />
                    Submit OT Request
                  </>
                )}
              </Button>
            </VStack>
          </form>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>My OT Requests</CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <VStack gap="4" align="center">
                <div className="rounded-full bg-muted p-6">
                  <Icon
                    name="ClockClockwise"
                    size={IconSizes.xl}
                    className="text-muted-foreground"
                  />
                </div>
                <VStack gap="2" align="center">
                  <H3 className="text-lg font-semibold">No OT Requests Yet</H3>
                  <BodySmall className="text-muted-foreground max-w-md">
                    No OT requests yet.
                  </BodySmall>
                </VStack>
              </VStack>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req, idx) => (
                <Card
                  key={req.id}
                  className={`w-full ${idx > 0 ? "hidden md:block" : ""} ${
                    req.status === "pending"
                      ? "border-yellow-300"
                      : req.status === "approved"
                      ? "border-emerald-300"
                      : req.status === "rejected"
                      ? "border-destructive"
                      : "border-border"
                  }`}
                >
                  <CardContent className="w-full p-4 sm:p-6">
                    <div className="mb-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-bold text-lg">
                            {format(new Date(req.ot_date), "MMM dd, yyyy")}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/5 text-primary"
                          >
                            OT
                          </Badge>
                          <span className="text-lg font-bold text-primary">
                            {creditOvertimeHours(req.total_hours)}h
                          </span>
                        </div>

                        <div className="text-sm mb-2">
                          <strong>Time:</strong> {formatTime12h(req.start_time)} -{" "}
                          {formatTime12h(req.end_time)}
                        </div>

                        {req.reason && (
                          <div className="text-sm mb-2">
                            <strong>Reason:</strong>
                            <div className="mt-1 text-muted-foreground">
                              {req.reason}
                            </div>
                          </div>
                        )}

                        {req.bundy_session && (
                          <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
                            <BodySmall className="font-semibold text-primary">
                              Bundy clock (reference) · Claimed {creditOvertimeHours(req.total_hours)}h
                            </BodySmall>
                            <div>
                              Time In:{" "}
                              {format(
                                new Date(req.bundy_session.clock_in_time),
                                "MMM d, h:mm a"
                              )}
                              {req.bundy_session.clock_in_lat != null &&
                                req.bundy_session.clock_in_lng != null && (
                                  <>
                                    {" "}
                                    · {req.bundy_session.clock_in_lat.toFixed(6)},{" "}
                                    {req.bundy_session.clock_in_lng.toFixed(6)}
                                  </>
                                )}
                            </div>
                            <div>
                              Time Out:{" "}
                              {format(
                                new Date(req.bundy_session.clock_out_time),
                                "MMM d, h:mm a"
                              )}
                              {req.bundy_session.clock_out_lat != null &&
                                req.bundy_session.clock_out_lng != null && (
                                  <>
                                    {" "}
                                    · {req.bundy_session.clock_out_lat.toFixed(6)},{" "}
                                    {req.bundy_session.clock_out_lng.toFixed(6)}
                                  </>
                                )}
                            </div>
                          </div>
                        )}

                        {req.overtime_documents &&
                          req.overtime_documents.length > 0 && (
                          <div className="hidden md:block">
                            <VStack gap="1" align="start" className="mt-2">
                                <HStack gap="2" align="center">
                                  <Icon name="FileText" size={IconSizes.sm} />
                                  <BodySmall className="font-semibold">
                                    Supporting document
                                    {req.overtime_documents.length > 1 ? "s" : ""}
                                  </BodySmall>
                                </HStack>
                                {req.overtime_documents.map((d) => (
                                  <Caption
                                    key={d.id}
                                    className="text-muted-foreground"
                                  >
                                    {d.file_name}
                                  </Caption>
                                ))}
                              </VStack>
                          </div>
                          )}

                        {req.status === "pending" && !isManagerApproved(req) && (
                          <div className="hidden md:block mt-3 w-full space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
                            <Label
                              htmlFor={`replace-doc-${req.id}`}
                              className="text-xs font-medium"
                            >
                              Replace supporting document (PDF/DOC/DOCX)
                            </Label>
                            <input
                              id={`replace-doc-${req.id}`}
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) {
                                  setReplaceDocByRequestId((prev) => ({
                                    ...prev,
                                    [req.id]: null,
                                  }));
                                  return;
                                }
                                if (!isAllowedFile(file)) {
                                  toast.error("Only PDF, DOC, or DOCX files are allowed.");
                                  e.target.value = "";
                                  return;
                                }
                                if (file.size > MAX_FILE_SIZE) {
                                  toast.error("File too large. Max size is 5MB.");
                                  e.target.value = "";
                                  return;
                                }
                                setReplaceDocByRequestId((prev) => ({
                                  ...prev,
                                  [req.id]: file,
                                }));
                              }}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={
                                replaceDocLoadingId === req.id ||
                                !replaceDocByRequestId[req.id]
                              }
                              onClick={async () => {
                                const file = replaceDocByRequestId[req.id];
                                if (!file || !employee?.id) return;
                                setReplaceDocLoadingId(req.id);
                                try {
                                  const base64 = await fileToBase64(file);
                                  const res = await fetch(
                                    "/api/employee-portal/overtime-requests",
                                    {
                                      method: "PATCH",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        request_id: req.id,
                                        employee_id: employee.id,
                                        document: {
                                          file_name: file.name,
                                          file_type: resolveMimeType(file),
                                          file_size: file.size,
                                          file_base64: base64,
                                        },
                                      }),
                                    }
                                  );
                                  const payload = await res.json();
                                  if (!res.ok) {
                                    toast.error(
                                      payload?.error || "Failed to update document"
                                    );
                                  } else {
                                    if (payload?.warning) {
                                      toast.warning(payload.warning);
                                    } else {
                                      toast.success("Supporting document updated");
                                    }
                                    setReplaceDocByRequestId((prev) => ({
                                      ...prev,
                                      [req.id]: null,
                                    }));
                                    await loadRequests();
                                  }
                                } catch (err) {
                                  console.error(err);
                                  toast.error("Failed to update document");
                                } finally {
                                  setReplaceDocLoadingId(null);
                                }
                              }}
                            >
                              {replaceDocLoadingId === req.id
                                ? "Uploading..."
                                : "Save new file"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <VStack
                        gap="2"
                        align="end"
                        className="w-full lg:ml-4 lg:w-auto"
                      >
                        {req.status === "pending" && !isManagerApproved(req) && (
                          <>
                            <Badge
                              variant="outline"
                              className={`flex w-full items-center justify-center gap-2 text-center lg:w-auto ${statusStyles.pending}`}
                            >
                              <Icon name="Hourglass" size={IconSizes.sm} />
                              PENDING
                            </Badge>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full lg:w-auto"
                              disabled={cancelLoading === req.id}
                              onClick={async () => {
                                setCancelLoading(req.id);
                                const response = await fetch(
                                  "/api/employee-portal/overtime-requests",
                                  {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      request_id: req.id,
                                      employee_id: employee.id,
                                    }),
                                  }
                                );
                                const payload = await response.json();
                                if (!response.ok) {
                                  toast.error(
                                    payload?.error ||
                                      "Failed to cancel OT request"
                                  );
                                } else {
                                  toast.success("OT request removed");
                                  await loadRequests();
                                }
                                setCancelLoading(null);
                              }}
                            >
                              {cancelLoading === req.id
                                ? "Cancelling..."
                                : "Cancel"}
                            </Button>
                          </>
                        )}
                        {isManagerApproved(req) && (
                          <>
                            <Badge
                              variant="outline"
                              className="flex w-full items-center justify-center gap-2 text-center bg-emerald-600 text-white border-emerald-600 lg:w-auto"
                            >
                              <Icon name="CheckCircle" size={IconSizes.sm} />
                              APPROVED BY OPERATIONS MANAGER
                            </Badge>
                            <div className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-900 lg:max-w-[220px] lg:text-right">
                              {req.manager_approval_name && (
                                <div className="font-semibold">
                                  {req.manager_approval_name}
                                </div>
                              )}
                              {req.project_manager_approved_at && (
                                <div className="text-emerald-700">
                                  {formatPHTime(
                                    req.project_manager_approved_at,
                                    "MMM dd, yyyy h:mm a"
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {req.status === "approved" && (
                          <Badge
                            variant="outline"
                            className={`flex w-full items-center justify-center gap-2 text-center lg:w-auto ${statusStyles.approved}`}
                          >
                            <Icon name="CheckCircle" size={IconSizes.sm} />
                            APPROVED
                          </Badge>
                        )}
                        {req.status === "approved" &&
                          (req.final_approval_name || req.approved_at) && (
                            <div className="w-full rounded-md border bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-900 lg:max-w-[220px] lg:text-right">
                              <div className="font-semibold">Approved by HR</div>
                              {req.final_approval_name && (
                                <div>{req.final_approval_name}</div>
                              )}
                              {req.approved_at && (
                                <div className="text-emerald-700">
                                  {formatPHTime(
                                    req.approved_at,
                                    "MMM dd, yyyy h:mm a"
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        {req.status === "rejected" && (
                          <Badge
                            variant="outline"
                            className={`flex w-full items-center justify-center gap-2 text-center lg:w-auto ${statusStyles.rejected}`}
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            REJECTED
                          </Badge>
                        )}
                        {/* "Cancelled" state is represented as REJECTED in the new schema */}
                      </VStack>
                    </div>

                    <div className="text-xs text-muted-foreground mt-2">
                      Filed:{" "}
                      {format(new Date(req.created_at), "MMM dd, yyyy h:mm a")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </VStack>
  );
}