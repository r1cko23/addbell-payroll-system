"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTitle, H3, BodySmall } from "@/components/ui/typography";
import {
  epCardInteractive,
  epFormActionButton,
  epFormActions,
  epInlineField,
  epPageHeaderRow,
  epPageWrapper,
  epTouchButton,
} from "@/lib/employee-portal-ui";
import { epRequestFiledLine } from "@/lib/employee-portal-request-history";
import { cn } from "@/lib/utils";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { format, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/utils/format";
import { EmployeePayslipDetail } from "@/components/EmployeePayslipDetail";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PayslipPreviewDialogBody,
  PayslipPreviewDialogContent,
  PayslipPreviewDialogFooter,
  PayslipPreviewDialogHeader,
  PayslipPreviewDocument,
} from "@/components/employee-portal/PayslipPreviewDialog";
import { toast } from "sonner";
import type { EmployeeProfileForPayslip } from "@/lib/payslip-display";
import { downloadPayslipPdfFromDom } from "@/utils/payslip-download-from-dom";

interface Payslip {
  id: string;
  employee_id: string;
  payslip_number: string;
  period_start: string;
  period_end: string;
  period_type: string;
  status: "draft" | "approved" | "paid";
  gross_pay: number;
  net_pay: number;
  sss_amount: number;
  philhealth_amount: number;
  pagibig_amount: number;
  withholding_tax: number;
  total_deductions: number;
  adjustment_amount: number;
  adjustment_reason: string | null;
  allowance_amount: number;
  earnings_breakdown: any;
  deductions_breakdown: any;
  created_at: string;
  updated_at: string;
}

function payslipMonthKey(payslip: Payslip): string {
  const dateStr = String(payslip.period_end || payslip.period_start).split("T")[0];
  return format(parseISO(dateStr), "yyyy-MM");
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

export default function EmployeePayslipsPage() {
  const { employee } = useEmployeeSession();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<EmployeeProfileForPayslip | null>(
    null
  );
  const [holidays, setHolidays] = useState<Array<{ holiday_date: string }>>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [printPreviewReady, setPrintPreviewReady] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    payslips.forEach((p) => keys.add(payslipMonthKey(p)));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [payslips]);

  const filteredPayslips = useMemo(() => {
    if (!selectedMonth) return payslips;
    return payslips.filter((p) => payslipMonthKey(p) === selectedMonth);
  }, [payslips, selectedMonth]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth((prev) =>
      prev && monthOptions.includes(prev) ? prev : monthOptions[0]
    );
  }, [monthOptions]);

  const payslipProfile = useMemo((): EmployeeProfileForPayslip | null => {
    if (!profile) return null;
    return {
      employee_id: employee.employee_id,
      full_name: profile.full_name || employee.full_name,
      position: profile.position ?? null,
      employment_type: profile.employment_type ?? null,
      job_level: profile.job_level ?? null,
      salary_basis: profile.salary_basis ?? null,
      base_rate: profile.base_rate ?? null,
      hire_date: profile.hire_date ?? null,
    };
  }, [profile, employee]);

  useEffect(() => {
    loadPayslips();
    loadProfile();
  }, [employee.id]);

  async function loadPayslips() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/employee-portal/payslips?employee_id=${encodeURIComponent(
          employee.id
        )}`
      );
      const payload = await response.json();

      if (!response.ok) {
        console.error("Error loading payslips:", payload);
        toast.error("Failed to load payslips");
        return;
      }

      const payslipData = (payload.payslips as Payslip[]) || [];
      setPayslips(payslipData);
      if (payslipData.length > 0) {
        const starts = payslipData.map((p) => p.period_start).sort();
        const ends = payslipData.map((p) => p.period_end).sort();
        await loadHolidays(starts[0], ends[ends.length - 1]);
      }
    } catch (err) {
      console.error("Exception loading payslips:", err);
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    try {
      const response = await fetch(
        `/api/employee-portal/employee-profile?employee_id=${encodeURIComponent(
          employee.id
        )}`
      );
      const payload = await response.json();
      if (!response.ok) return;
      setProfile({
        employee_id: employee.employee_id,
        full_name: payload.full_name || employee.full_name,
        position: payload.position ?? null,
        employment_type: payload.employment_type ?? null,
        job_level: payload.job_level ?? null,
        salary_basis: payload.salary_basis ?? null,
        base_rate: payload.base_rate ?? null,
        hire_date: payload.hire_date ?? null,
      });
    } catch {
      setProfile({
        employee_id: employee.employee_id,
        full_name: employee.full_name,
      });
    }
  }

  async function loadHolidays(start: string, end: string) {
    try {
      const response = await fetch(
        `/api/employee-portal/holidays?start=${encodeURIComponent(
          start
        )}&end=${encodeURIComponent(end)}`
      );
      const payload = await response.json();
      if (response.ok && Array.isArray(payload.holidays)) {
        setHolidays(payload.holidays);
      }
    } catch {
      setHolidays([]);
    }
  }

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case "paid":
        return "default";
      case "approved":
        return "secondary";
      case "draft":
        return "outline";
      default:
        return "outline";
    }
  }

  function openPayslipPreview(payslip: Payslip) {
    setSelectedPayslip(payslip);
    setPrintPreviewReady(false);
    setShowPayslipModal(true);
  }

  async function handleDownloadPdf() {
    if (!selectedPayslip) return;
    if (!printPreviewReady) {
      toast.error("Payslip is still loading. Try again in a moment.");
      return;
    }

    const payslipContainer = document.getElementById("payslip-print-content");
    if (!payslipContainer) {
      toast.error("Payslip content not found");
      return;
    }

    setDownloadingPdf(true);
    try {
      const filename = `payslip-${selectedPayslip.period_end.split("T")[0]}.pdf`;
      await downloadPayslipPdfFromDom(payslipContainer, filename);
      toast.success("Payslip PDF downloaded");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to download PDF";
      toast.error(message);
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handlePrint() {
    // Find the payslip container
    const payslipContainer = document.getElementById("payslip-print-content");
    if (!payslipContainer) {
      toast.error("Payslip content not found");
      return;
    }

    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print payslip");
      return;
    }

    // Get the payslip HTML content
    const payslipHTML = payslipContainer.outerHTML;

    // Write the HTML document with print styles
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payslip - ${selectedPayslip?.employee_id || "Employee"}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              background: white;
              color: black;
              font-family: Arial, sans-serif;
            }
            .payslip-container {
              width: 8.5in;
              padding: 0.5in;
              margin: 0 auto;
              background: white;
              color: black;
            }
            @media print {
              @page {
                size: letter portrait;
                margin: 0.5in;
              }
              html, body {
                margin: 0;
                padding: 0;
                background: white;
              }
              .payslip-container {
                margin: 0 auto;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${payslipHTML}
          <script>
            // Auto-print when window loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (loading) {
    return (
      <div className={cn("w-full", epPageWrapper)}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className={cn("mx-auto w-full max-w-6xl", epPageWrapper)}>
        <div className={epPageHeaderRow}>
          <PageTitle className="min-w-0 shrink-0">My Payslips</PageTitle>
          {payslips.length > 0 ? (
            <div className={epInlineField}>
              <BodySmall className="shrink-0 text-muted-foreground">Month</BodySmall>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="min-h-11 w-full sm:min-h-9 sm:w-[14rem]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((key) => (
                    <SelectItem key={key} value={key}>
                      {formatMonthLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {payslips.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <VStack gap="4" align="center">
                  <div className="rounded-full bg-muted p-6">
                    <Icon
                      name="FileText"
                      size={IconSizes.xl}
                      className="text-muted-foreground"
                    />
                  </div>
                  <VStack gap="2" align="center">
                    <H3 className="text-xl font-semibold">No Payslips Found</H3>
                    <BodySmall className="text-muted-foreground max-w-md">
                      Payslips will appear here once available.
                    </BodySmall>
                  </VStack>
                </VStack>
              </CardContent>
            </Card>
          ) : filteredPayslips.length === 0 ? (
            <Card className="w-full">
              <CardContent className="py-12 text-center">
                <BodySmall className="text-muted-foreground">
                  No payslips for{" "}
                  {selectedMonth ? formatMonthLabel(selectedMonth) : "this month"}.
                </BodySmall>
              </CardContent>
            </Card>
          ) : (
            <VStack gap="3" className="w-full items-stretch">
              {filteredPayslips.map((payslip) => (
                <Card
                  key={payslip.id}
                  className={cn(
                    "w-full border-border/80 bg-card",
                    epCardInteractive
                  )}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid w-full grid-cols-1 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-5">
                      <VStack gap="1" align="start" className="min-w-0">
                        <HStack gap="2" align="center" className="flex-wrap">
                          <p className="text-sm font-semibold leading-tight text-foreground">
                            {format(new Date(payslip.period_start), "MMM d")} –{" "}
                            {format(
                              new Date(payslip.period_end),
                              "MMM d, yyyy"
                            )}
                          </p>
                          <Badge
                            variant={getStatusBadgeVariant(payslip.status)}
                            className="shrink-0 text-[10px] px-1.5 py-0"
                          >
                            {payslip.status.toUpperCase()}
                          </Badge>
                        </HStack>
                        <BodySmall className="truncate text-xs text-muted-foreground">
                          Payslip #{payslip.payslip_number}
                        </BodySmall>
                        <p className={epRequestFiledLine}>
                          Created:{" "}
                          {format(
                            new Date(payslip.created_at),
                            "MMM d, yyyy h:mm a"
                          )}
                        </p>
                      </VStack>

                      <div className="flex w-full min-w-0 flex-col gap-2.5 lg:w-[17rem] lg:shrink-0 lg:justify-self-end">
                        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2">
                          <VStack gap="1" align="start" className="min-w-0">
                            <BodySmall className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                              Gross Pay
                            </BodySmall>
                            <BodySmall className="truncate text-[11px] font-semibold tabular-nums text-muted-foreground sm:text-sm">
                              {formatCurrency(payslip.gross_pay)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="start" className="min-w-0">
                            <BodySmall className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                              Deductions
                            </BodySmall>
                            <BodySmall className="truncate text-[11px] font-semibold tabular-nums text-muted-foreground sm:text-sm">
                              −{formatCurrency(payslip.total_deductions)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="start" className="min-w-0">
                            <BodySmall className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                              Net Pay
                            </BodySmall>
                            <BodySmall className="truncate text-[11px] font-semibold tabular-nums text-foreground sm:text-sm">
                              {formatCurrency(payslip.net_pay)}
                            </BodySmall>
                          </VStack>
                        </div>

                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openPayslipPreview(payslip)}
                          className={cn(
                            epTouchButton,
                            "bg-primary text-primary-foreground hover:bg-primary/90"
                          )}
                        >
                          <Icon name="FileText" size={IconSizes.sm} />
                          View & Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </VStack>
          )}
      </div>

      {/* Payslip preview — same layout as HR /payslips Print Payslip */}
      <Dialog
        open={showPayslipModal}
        onOpenChange={(open) => {
          setShowPayslipModal(open);
          if (!open) setPrintPreviewReady(false);
        }}
      >
        <PayslipPreviewDialogContent>
          {selectedPayslip && payslipProfile ? (
            <>
              <PayslipPreviewDialogHeader>
                <DialogHeader className="space-y-0.5 text-left">
                  <DialogTitle className="text-base sm:text-lg">Payslip</DialogTitle>
                  <BodySmall className="text-muted-foreground">
                    Scroll if needed — actions are fixed below.
                  </BodySmall>
                </DialogHeader>
              </PayslipPreviewDialogHeader>
              <PayslipPreviewDialogBody>
                <PayslipPreviewDocument>
                  <EmployeePayslipDetail
                    key={`preview-${selectedPayslip.id}`}
                    payslip={selectedPayslip}
                    profile={payslipProfile}
                    holidays={holidays}
                    variant="print"
                    onPrintPreviewReady={setPrintPreviewReady}
                  />
                </PayslipPreviewDocument>
              </PayslipPreviewDialogBody>
              <PayslipPreviewDialogFooter>
                <DialogFooter
                  className={cn(
                    "print:hidden m-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                    epFormActions
                  )}
                >
                  <Button
                    variant="secondary"
                    className={epFormActionButton}
                    onClick={() => setShowPayslipModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadPdf}
                    disabled={!printPreviewReady || downloadingPdf}
                    className={epFormActionButton}
                  >
                    <Icon name="Download" size={IconSizes.sm} />
                    {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
                  </Button>
                  <Button
                    onClick={handlePrint}
                    disabled={!printPreviewReady}
                    className={cn(
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      epFormActionButton
                    )}
                  >
                    <Icon name="Printer" size={IconSizes.sm} />
                    Print
                  </Button>
                </DialogFooter>
              </PayslipPreviewDialogFooter>
            </>
          ) : selectedPayslip ? (
            <>
              <PayslipPreviewDialogHeader>
                <DialogHeader className="text-left">
                  <DialogTitle>Payslip</DialogTitle>
                </DialogHeader>
              </PayslipPreviewDialogHeader>
              <PayslipPreviewDialogBody>
                <BodySmall className="text-muted-foreground py-4">
                  Loading pay rates… refresh the page if this message persists.
                </BodySmall>
              </PayslipPreviewDialogBody>
            </>
          ) : null}
        </PayslipPreviewDialogContent>
      </Dialog>
    </div>
  );
}