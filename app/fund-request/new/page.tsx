"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
// import { useProfile } from "@/lib/hooks/useProfile";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PURPOSE_OPTIONS = [
  "Material Purchase",
  "Subcontractor Payment",
  "Project Funds",
  "Liquidation",
  "Others",
] as const;

const DETAIL_ROWS = 5;

type DetailRow = { description: string; amount: string };

export default function NewFundRequestPage() {
  const pathname = usePathname();
  const router = useRouter();
  // const { profile, loading: profileLoading } = useProfile();
  const { user, loading: userLoading } = useCurrentUser();
  const session = useEmployeeSession();
  const supabase = createClient();
  const employeeId = session?.employee?.id ?? null;
  const isPortal = (pathname?.startsWith("/app") || pathname?.startsWith("/employee-portal")) ?? false;
  const base = pathname?.startsWith("/employee-portal") ? "/employee-portal/fund-request" : isPortal ? "/app/fund-request" : "/fund-request";

  const [requesterName, setRequesterName] = useState<string>("");
  const [requestDate, setRequestDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [purposeOption, setPurposeOption] = useState<string>("");
  const [purposeOther, setPurposeOther] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [poAmount, setPoAmount] = useState("");
  const [currentProjectPercentage, setCurrentProjectPercentage] = useState("");
  const [details, setDetails] = useState<DetailRow[]>(() =>
    Array.from({ length: DETAIL_ROWS }, () => ({
      description: "",
      amount: "",
    })),
  );
  const [dateNeeded, setDateNeeded] = useState("");
  const [urgentReason, setUrgentReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Use session name when available (employee portal) so "Requested by" shows immediately
  useEffect(() => {
    if (session?.employee?.full_name) {
      setRequesterName(session.employee.full_name);
    }
  }, [session?.employee?.full_name]);

  const detailAmounts = details.map((d) => (d.amount ? Number(d.amount) : 0));
  const totalRequested = detailAmounts.reduce((a, b) => a + b, 0);

  const updateDetail = (
    index: number,
    field: "description" | "amount",
    value: string,
  ) => {
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Employee not found.");
      return;
    }
    const purposeValue =
      purposeOption === "Others" ? purposeOther.trim() : purposeOption;
    if (!purposeValue) {
      toast.error(
        purposeOption === "Others"
          ? "Please enter the purpose (Others)."
          : "Please select a purpose.",
      );
      return;
    }
    if (totalRequested <= 0) {
      toast.error("Add at least one detail line with an amount.");
      return;
    }
    if (!dateNeeded) {
      toast.error("Date needed is required.");
      return;
    }

    setSubmitting(true);
    try {
      const detailsPayload = details
        .filter((d) => d.description.trim() || d.amount)
        .map((d) => ({
          description: d.description.trim() || "",
          amount: d.amount ? Number(d.amount) : 0,
        }));
      if (detailsPayload.length === 0) {
        toast.error("Add at least one detail with amount.");
        setSubmitting(false);
        return;
      }

      // Fetch employee's company_id (required by fund_requests table).
      // Employee portal uses anon key so RLS may block; fallback to Addbell company.
      let companyId: string | null = null;
      const { data: emp } = await supabase
        .from("employees")
        .select("company_id")
        .eq("id", employeeId)
        .single();
      companyId = emp?.company_id ?? null;
      if (!companyId) {
        // Addbell single-company fallback (from existing fund_requests)
        const { data: first } = await supabase
          .from("fund_requests")
          .select("company_id")
          .limit(1)
          .single();
        companyId = first?.company_id ?? null;
      }
      if (!companyId) {
        toast.error("Could not determine company. Contact HR.");
        setSubmitting(false);
        return;
      }

      // Initial status is always pending for now
      const initialStatus = "pending";

      const payload = {
        company_id: companyId,
        requested_by: employeeId,
        request_date: requestDate,
        purpose: purposeValue,
        po_number: poNumber.trim() || null,
        project_title: projectTitle.trim() || null,
        project_location: projectLocation.trim() || null,
        po_amount: poAmount ? Number(poAmount) : null,
        current_project_percentage: currentProjectPercentage
          ? Number(currentProjectPercentage)
          : null,
        details: detailsPayload,
        total_requested_amount: totalRequested,
        date_needed: dateNeeded,
        urgent_reason: urgentReason.trim() || null,
        status: initialStatus,
        // submitted_by can be inferred from auth.uid() or session
      };

      const { error } = await supabase
        .from("fund_requests")
        .insert(payload as never);
      if (error) throw error;
      toast.success("Fund request submitted.");
      router.push(base);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  // const loading = profileLoading && !session?.employee?.id;
  const loading = userLoading && !session?.employee?.id;
  if (loading)
    return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;
  if (!employeeId) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800">
        Your account is not linked to an employee. Contact HR.
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 max-h-[calc(100vh-6rem)] w-full max-w-6xl gap-4 overflow-hidden">
      <Link
        href={base}
        className="text-muted-foreground hover:text-foreground text-sm shrink-0"
      >
        ← Back to Fund Request
      </Link>
      <Card className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <CardHeader className="pb-4 shrink-0">
          <CardTitle>Fund Request Form</CardTitle>
          <p className="text-sm text-muted-foreground">
            Addbell Technical Services, Inc. — Requester → Project Manager →
            Purchasing Officer → Upper Management
          </p>
        </CardHeader>
        <CardContent className="overflow-y-auto min-h-0 flex-1">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Two-column layout: left = request + description, right = details + date/urgent + actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Left column */}
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Requested by</Label>
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                      {requesterName || "Loading..."}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="request_date">Date</Label>
                    <Input
                      id="request_date"
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="purpose">Purpose *</Label>
                  <Select
                    value={purposeOption}
                    onValueChange={setPurposeOption}
                    required
                  >
                    <SelectTrigger id="purpose">
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {purposeOption === "Others" && (
                    <Input
                      className="mt-2"
                      value={purposeOther}
                      onChange={(e) => setPurposeOther(e.target.value)}
                      placeholder="Specify purpose"
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold border-b pb-2 mb-3">
                    Description
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label htmlFor="po_number">P.O. Number</Label>
                      <Input
                        id="po_number"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="project_title">Project Title</Label>
                      <Input
                        id="project_title"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="project_location">Project Location</Label>
                      <Input
                        id="project_location"
                        value={projectLocation}
                        onChange={(e) => setProjectLocation(e.target.value)}
                        placeholder="e.g. Site name, city"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="po_amount">P.O. Amount (PHP)</Label>
                        <Input
                          id="po_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={poAmount}
                          onChange={(e) => setPoAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="current_project_percentage">
                          Current Project %
                        </Label>
                        <Input
                          id="current_project_percentage"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={currentProjectPercentage}
                          onChange={(e) =>
                            setCurrentProjectPercentage(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold border-b pb-2 mb-2">
                    Details of Request
                  </h3>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[1fr_100px] gap-2 text-xs font-medium text-muted-foreground">
                      <span>Details</span>
                      <span className="text-right">Amount (PHP)</span>
                    </div>
                    {details.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_100px] gap-2">
                        <Input
                          placeholder={`Item ${i + 1}`}
                          value={row.description}
                          onChange={(e) =>
                            updateDetail(i, "description", e.target.value)
                          }
                          className="min-w-0"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={row.amount}
                          onChange={(e) =>
                            updateDetail(i, "amount", e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-medium mt-2">
                    Total: PHP{" "}
                    {totalRequested.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="date_needed">Date needed *</Label>
                    <Input
                      id="date_needed"
                      type="date"
                      value={dateNeeded}
                      onChange={(e) => setDateNeeded(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="urgent_reason">
                      *If urgent, state reason
                    </Label>
                    <Textarea
                      id="urgent_reason"
                      value={urgentReason}
                      onChange={(e) => setUrgentReason(e.target.value)}
                      placeholder="Reason for urgency (optional)"
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  *NOTE: Provide attachments (Quotation, Invoice, Purchase
                  Order, etc.) to your supervisor or HR as needed.
                </p>
                <div className="flex gap-3 pt-1">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit fund request"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(base)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}