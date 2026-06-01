"use client";

import { useEffect, useMemo, useState } from "react";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { H1, H2, H3, BodySmall, Caption } from "@/components/ui/typography";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { EmployeeProfileForPayslip } from "@/lib/payslip-display";

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
      <VStack gap="6" className="w-full">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </VStack>
    );
  }

  return (
    <div className="w-full py-2">
      <div className="mx-auto w-full max-w-6xl">
        <CardSection className="w-full">
          <HStack
            align="start"
            justify="between"
            className="mb-6 w-full flex-col gap-4 sm:flex-row sm:items-end"
          >
            <VStack gap="1" align="start" className="min-w-0">
              <H1>My Payslips</H1>
              <BodySmall className="text-muted-foreground">
                View and print your payslips.
              </BodySmall>
            </VStack>
            {payslips.length > 0 ? (
              <VStack gap="1" align="start" className="w-full sm:w-auto sm:min-w-[14rem]">
                <Caption className="text-muted-foreground">Month</Caption>
                <Select
                  value={selectedMonth}
                  onValueChange={setSelectedMonth}
                >
                  <SelectTrigger className="w-full sm:w-[14rem]">
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
              </VStack>
            ) : null}
          </HStack>

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
            <VStack gap="4" className="w-full items-stretch">
              {selectedMonth ? (
                <BodySmall className="text-muted-foreground">
                  {filteredPayslips.length} payslip
                  {filteredPayslips.length === 1 ? "" : "s"} in{" "}
                  {formatMonthLabel(selectedMonth)}
                </BodySmall>
              ) : null}
              {filteredPayslips.map((payslip) => (
                <Card
                  key={payslip.id}
                  className="w-full min-h-[11.5rem] border-border/80 bg-card/95 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover"
                >
                  <CardContent className="flex min-h-[11.5rem] w-full flex-col justify-center p-5 sm:p-6">
                    <div className="grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
                      <VStack gap="2" align="start" className="min-w-0 justify-center">
                        <HStack gap="3" align="center" className="flex-wrap">
                          <H2 className="text-lg leading-tight">
                            {format(new Date(payslip.period_start), "MMM d")} –{" "}
                            {format(
                              new Date(payslip.period_end),
                              "MMM d, yyyy"
                            )}
                          </H2>
                          <Badge
                            variant={getStatusBadgeVariant(payslip.status)}
                            className="shrink-0"
                          >
                            {payslip.status.toUpperCase()}
                          </Badge>
                        </HStack>
                        <BodySmall className="text-muted-foreground truncate w-full">
                          Payslip #{payslip.payslip_number}
                        </BodySmall>
                        <Caption className="text-muted-foreground">
                          {format(
                            new Date(payslip.created_at),
                            "MMM d, yyyy 'at' h:mm a"
                          ).toUpperCase()}
                        </Caption>
                      </VStack>

                      <div className="flex w-full flex-col justify-between gap-4 lg:w-[20rem] lg:shrink-0 lg:justify-self-end">
                        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
                          <VStack gap="1" align="end" className="min-w-0">
                            <Caption className="text-muted-foreground whitespace-nowrap">
                              Gross Pay
                            </Caption>
                            <BodySmall className="font-semibold tabular-nums">
                              {formatCurrency(payslip.gross_pay)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end" className="min-w-0">
                            <Caption className="text-muted-foreground whitespace-nowrap">
                              Deductions
                            </Caption>
                            <BodySmall className="font-semibold tabular-nums text-destructive">
                              −{formatCurrency(payslip.total_deductions)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end" className="min-w-0">
                            <Caption className="text-muted-foreground whitespace-nowrap">
                              Net Pay
                            </Caption>
                            <p className="text-lg font-bold tabular-nums text-primary sm:text-xl">
                              {formatCurrency(payslip.net_pay)}
                            </p>
                          </VStack>
                        </div>

                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openPayslipPreview(payslip)}
                          className="gradient-accent h-9 w-full"
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
        </CardSection>
      </div>

      {/* Payslip preview — same layout as HR /payslips Print Payslip */}
      <Dialog
        open={showPayslipModal}
        onOpenChange={(open) => {
          setShowPayslipModal(open);
          if (!open) setPrintPreviewReady(false);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedPayslip && payslipProfile ? (
            <>
              <DialogHeader>
                <DialogTitle>Payslip Preview</DialogTitle>
              </DialogHeader>
              <VStack gap="4">
                <EmployeePayslipDetail
                  key={`preview-${selectedPayslip.id}`}
                  payslip={selectedPayslip}
                  profile={payslipProfile}
                  holidays={holidays}
                  variant="print"
                  onPrintPreviewReady={setPrintPreviewReady}
                />
                <DialogFooter className="print:hidden sm:justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setShowPayslipModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handlePrint}
                    disabled={!printPreviewReady}
                    className="gradient-accent"
                  >
                    <Icon name="Printer" size={IconSizes.sm} />
                    Print Payslip
                  </Button>
                </DialogFooter>
              </VStack>
            </>
          ) : selectedPayslip ? (
            <>
              <DialogHeader>
                <DialogTitle>Payslip Preview</DialogTitle>
              </DialogHeader>
              <BodySmall className="text-muted-foreground py-4">
                Loading pay rates… refresh the page if this message persists.
              </BodySmall>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}