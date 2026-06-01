"use client";

import { useEffect, useMemo, useState } from "react";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { H1, H2, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/format";
import { EmployeePayslipDetail } from "@/components/EmployeePayslipDetail";
import {
  Dialog,
  DialogContent,
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

export default function EmployeePayslipsPage() {
  const { employee } = useEmployeeSession();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<EmployeeProfileForPayslip | null>(
    null
  );
  const [holidays, setHolidays] = useState<Array<{ holiday_date: string }>>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

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

  function handleViewPayslip(payslip: Payslip) {
    setSelectedPayslip(payslip);
    setShowPrintModal(true);
  }

  function handleViewBreakdown(payslip: Payslip) {
    setSelectedPayslip(payslip);
    setShowBreakdownModal(true);
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

  function handleDownload() {
    if (!selectedPayslip) return;

    // Create a new window for printing/downloading
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to download payslip");
      return;
    }

    // Get the payslip print HTML
    const printContent = document.getElementById("payslip-print-content");
    if (printContent) {
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.close();
      printWindow.print();
    }
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
    <div className="py-2">
      <div className="mx-auto max-w-6xl">
        <CardSection>
          <HStack align="center" justify="between" className="mb-6">
            <VStack gap="1" align="start">
              <H1>My Payslips</H1>
              <BodySmall className="text-muted-foreground">
                View and print your payslips.
              </BodySmall>
            </VStack>
            <Icon
              name="CalendarBlank"
              size={IconSizes.lg}
              className="text-primary"
            />
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
          ) : (
            <VStack gap="4">
              {payslips.map((payslip) => (
                <Card key={payslip.id} className="border-border/80 bg-card/95 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover">
                  <CardContent className="p-6">
                    <HStack
                      align="center"
                      justify="between"
                      className="flex-wrap gap-4"
                    >
                      <VStack gap="2" align="start">
                        <HStack gap="3" align="center">
                          <H2 className="text-lg">
                            {format(new Date(payslip.period_start), "MMM d")} -{" "}
                            {format(
                              new Date(payslip.period_end),
                              "MMM d, yyyy"
                            )}
                          </H2>
                          <Badge
                            variant={getStatusBadgeVariant(payslip.status)}
                          >
                            {payslip.status.toUpperCase()}
                          </Badge>
                        </HStack>
                        <BodySmall className="text-muted-foreground">
                          Payslip #{payslip.payslip_number}
                        </BodySmall>
                        <Caption className="text-muted-foreground">
                          {format(
                            new Date(payslip.created_at),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </Caption>
                      </VStack>

                      <VStack gap="2" align="end">
                        <HStack gap="4" align="center">
                          <VStack gap="1" align="end" className="hidden md:flex">
                            <Caption className="text-muted-foreground">
                              Gross Pay
                            </Caption>
                            <BodySmall className="font-semibold">
                              {formatCurrency(payslip.gross_pay)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end" className="hidden md:flex">
                            <Caption className="text-muted-foreground">
                              Total Deductions
                            </Caption>
                            <BodySmall className="font-semibold text-destructive">
                              -{formatCurrency(payslip.total_deductions)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end">
                            <Caption className="text-muted-foreground">Net Pay</Caption>
                            <H2 className="text-xl text-primary">
                              {formatCurrency(payslip.net_pay)}
                            </H2>
                          </VStack>
                        </HStack>

                        <HStack
                          gap="2"
                          className="mt-2 flex-col sm:flex-row w-full"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBreakdown(payslip)}
                            className="w-full sm:w-auto"
                          >
                            <Icon name="Eye" size={IconSizes.sm} />
                            View Details
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleViewPayslip(payslip)}
                            className="gradient-accent"
                          >
                            <Icon name="FileText" size={IconSizes.sm} />
                            View & Download
                          </Button>
                        </HStack>
                      </VStack>
                    </HStack>
                  </CardContent>
                </Card>
              ))}
            </VStack>
          )}
        </CardSection>
      </div>

      {/* Print Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payslip</DialogTitle>
          </DialogHeader>
          {selectedPayslip && payslipProfile ? (
            <EmployeePayslipDetail
              payslip={selectedPayslip}
              profile={payslipProfile}
              holidays={holidays}
              variant="both"
              inlinePrint
            />
          ) : selectedPayslip ? (
            <BodySmall className="text-muted-foreground py-4">
              Loading pay rates… refresh the page if this message persists.
            </BodySmall>
          ) : null}
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowPrintModal(false)}>
              Close
            </Button>
            <Button onClick={handlePrint}>Print</Button>
            <Button onClick={handleDownload} className="gradient-accent">
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Breakdown Modal */}
      <Dialog open={showBreakdownModal} onOpenChange={setShowBreakdownModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payslip breakdown — {selectedPayslip?.payslip_number}
            </DialogTitle>
          </DialogHeader>
          {selectedPayslip && payslipProfile ? (
            <EmployeePayslipDetail
              payslip={selectedPayslip}
              profile={payslipProfile}
              holidays={holidays}
              variant="screen"
            />
          ) : selectedPayslip ? (
            <BodySmall className="text-muted-foreground py-4">
              Loading pay details…
            </BodySmall>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}