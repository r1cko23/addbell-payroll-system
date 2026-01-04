"use client";

import { useEffect, useState } from "react";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { H1, H2, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/format";
import { PayslipPrint } from "@/components/PayslipPrint";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileArrowDown, Eye, Calendar } from "phosphor-react";

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
  const supabase = createClient();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  useEffect(() => {
    loadPayslips();
  }, [employee.id]);

  async function loadPayslips() {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_employee_payslips", {
        p_employee_uuid: employee.id,
      } as any);

      if (error) {
        console.error("Error loading payslips:", error);
        toast.error("Failed to load payslips");
        return;
      }

      const payslipData = (data as Payslip[]) || [];
      setPayslips(payslipData);
    } catch (err) {
      console.error("Exception loading payslips:", err);
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <CardSection>
          <HStack align="center" justify="between" className="mb-6">
            <H1>My Payslips</H1>
            <Icon
              name="CalendarBlank"
              size={IconSizes.lg}
              className="text-emerald-600"
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
                      Your payslips will appear here once they are generated and
                      approved by HR.
                    </BodySmall>
                  </VStack>
                </VStack>
              </CardContent>
            </Card>
          ) : (
            <VStack gap="4">
              {payslips.map((payslip) => (
                <Card key={payslip.id} className="hover:shadow-md transition">
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
                        <BodySmall className="text-gray-600">
                          Payslip #{payslip.payslip_number}
                        </BodySmall>
                        <Caption className="text-gray-500">
                          {format(
                            new Date(payslip.created_at),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </Caption>
                      </VStack>

                      <VStack gap="2" align="end">
                        <HStack gap="4" align="center">
                          <VStack gap="1" align="end">
                            <Caption className="text-gray-500">
                              Gross Pay
                            </Caption>
                            <BodySmall className="font-semibold">
                              {formatCurrency(payslip.gross_pay)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end">
                            <Caption className="text-gray-500">
                              Total Deductions
                            </Caption>
                            <BodySmall className="font-semibold text-red-600">
                              -{formatCurrency(payslip.total_deductions)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end">
                            <Caption className="text-gray-500">Net Pay</Caption>
                            <H2 className="text-xl text-emerald-600">
                              {formatCurrency(payslip.net_pay)}
                            </H2>
                          </VStack>
                        </HStack>

                        <HStack gap="2" className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBreakdown(payslip)}
                          >
                            <Icon name="Eye" size={IconSizes.sm} />
                            View Details
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleViewPayslip(payslip)}
                            className="bg-emerald-600 hover:bg-emerald-700"
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
          {selectedPayslip && (
            <div id="payslip-print-content">
              <PayslipPrint
                employee={{
                  employee_id: employee.employee_id,
                  full_name: employee.full_name,
                  rate_per_day: 0,
                  rate_per_hour: 0,
                }}
                weekStart={new Date(selectedPayslip.period_start)}
                weekEnd={new Date(selectedPayslip.period_end)}
                attendance={selectedPayslip.earnings_breakdown || {}}
                earnings={{
                  regularPay:
                    selectedPayslip.earnings_breakdown?.regularPay || 0,
                  regularOT: selectedPayslip.earnings_breakdown?.regularOT || 0,
                  regularOTHours:
                    selectedPayslip.earnings_breakdown?.regularOTHours || 0,
                  nightDiff: selectedPayslip.earnings_breakdown?.nightDiff || 0,
                  nightDiffHours:
                    selectedPayslip.earnings_breakdown?.nightDiffHours || 0,
                  sundayRestDay:
                    selectedPayslip.earnings_breakdown?.sundayRestDay || 0,
                  sundayRestDayHours:
                    selectedPayslip.earnings_breakdown?.sundayRestDayHours || 0,
                  specialHoliday:
                    selectedPayslip.earnings_breakdown?.specialHoliday || 0,
                  specialHolidayHours:
                    selectedPayslip.earnings_breakdown?.specialHolidayHours ||
                    0,
                  regularHoliday:
                    selectedPayslip.earnings_breakdown?.regularHoliday || 0,
                  regularHolidayHours:
                    selectedPayslip.earnings_breakdown?.regularHolidayHours ||
                    0,
                  grossIncome: selectedPayslip.gross_pay,
                }}
                deductions={{
                  vale: selectedPayslip.deductions_breakdown?.vale_amount || 0,
                  sssLoan:
                    selectedPayslip.deductions_breakdown?.sss_salary_loan || 0,
                  sssCalamityLoan:
                    selectedPayslip.deductions_breakdown?.sss_calamity_loan ||
                    0,
                  pagibigLoan:
                    selectedPayslip.deductions_breakdown?.pagibig_salary_loan ||
                    0,
                  pagibigCalamityLoan:
                    selectedPayslip.deductions_breakdown
                      ?.pagibig_calamity_loan || 0,
                  sssContribution: selectedPayslip.sss_amount,
                  philhealthContribution: selectedPayslip.philhealth_amount,
                  pagibigContribution: selectedPayslip.pagibig_amount,
                  withholdingTax: selectedPayslip.withholding_tax,
                  totalDeductions: selectedPayslip.total_deductions,
                }}
                adjustment={selectedPayslip.adjustment_amount}
                netPay={selectedPayslip.net_pay}
                workingDays={0}
                absentDays={0}
                preparedBy="HR Department"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowPrintModal(false)}>
              Close
            </Button>
            <Button onClick={handlePrint}>Print</Button>
            <Button onClick={handleDownload} className="bg-emerald-600">
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Breakdown Modal */}
      <Dialog open={showBreakdownModal} onOpenChange={setShowBreakdownModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payslip Breakdown - {selectedPayslip?.payslip_number}
            </DialogTitle>
          </DialogHeader>
          {selectedPayslip && (
            <div className="space-y-6">
              {/* Period Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Period Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <VStack gap="2">
                    <HStack justify="between">
                      <BodySmall>Period:</BodySmall>
                      <BodySmall className="font-semibold">
                        {format(
                          new Date(selectedPayslip.period_start),
                          "MMM d"
                        )}{" "}
                        -{" "}
                        {format(
                          new Date(selectedPayslip.period_end),
                          "MMM d, yyyy"
                        )}
                      </BodySmall>
                    </HStack>
                    <HStack justify="between">
                      <BodySmall>Status:</BodySmall>
                      <Badge
                        variant={getStatusBadgeVariant(selectedPayslip.status)}
                      >
                        {selectedPayslip.status.toUpperCase()}
                      </Badge>
                    </HStack>
                  </VStack>
                </CardContent>
              </Card>

              {/* Earnings */}
              <Card>
                <CardHeader>
                  <CardTitle>Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  <VStack gap="2">
                    <HStack justify="between">
                      <BodySmall>Gross Pay:</BodySmall>
                      <BodySmall className="font-semibold">
                        {formatCurrency(selectedPayslip.gross_pay)}
                      </BodySmall>
                    </HStack>
                    {selectedPayslip.allowance_amount > 0 && (
                      <HStack justify="between">
                        <BodySmall>Allowance:</BodySmall>
                        <BodySmall className="font-semibold">
                          {formatCurrency(selectedPayslip.allowance_amount)}
                        </BodySmall>
                      </HStack>
                    )}
                    {selectedPayslip.adjustment_amount !== 0 && (
                      <HStack justify="between">
                        <BodySmall>
                          Adjustment{" "}
                          {selectedPayslip.adjustment_reason &&
                            `(${selectedPayslip.adjustment_reason})`}
                          :
                        </BodySmall>
                        <BodySmall
                          className={`font-semibold ${
                            selectedPayslip.adjustment_amount > 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {selectedPayslip.adjustment_amount > 0 ? "+" : ""}
                          {formatCurrency(selectedPayslip.adjustment_amount)}
                        </BodySmall>
                      </HStack>
                    )}
                  </VStack>
                </CardContent>
              </Card>

              {/* Deductions */}
              <Card>
                <CardHeader>
                  <CardTitle>Deductions</CardTitle>
                </CardHeader>
                <CardContent>
                  <VStack gap="2">
                    {selectedPayslip.sss_amount > 0 && (
                      <HStack justify="between">
                        <BodySmall>SSS Contribution:</BodySmall>
                        <BodySmall className="font-semibold text-red-600">
                          -{formatCurrency(selectedPayslip.sss_amount)}
                        </BodySmall>
                      </HStack>
                    )}
                    {selectedPayslip.philhealth_amount > 0 && (
                      <HStack justify="between">
                        <BodySmall>PhilHealth Contribution:</BodySmall>
                        <BodySmall className="font-semibold text-red-600">
                          -{formatCurrency(selectedPayslip.philhealth_amount)}
                        </BodySmall>
                      </HStack>
                    )}
                    {selectedPayslip.pagibig_amount > 0 && (
                      <HStack justify="between">
                        <BodySmall>Pag-IBIG Contribution:</BodySmall>
                        <BodySmall className="font-semibold text-red-600">
                          -{formatCurrency(selectedPayslip.pagibig_amount)}
                        </BodySmall>
                      </HStack>
                    )}
                    {selectedPayslip.withholding_tax > 0 && (
                      <HStack justify="between">
                        <BodySmall>Withholding Tax:</BodySmall>
                        <BodySmall className="font-semibold text-red-600">
                          -{formatCurrency(selectedPayslip.withholding_tax)}
                        </BodySmall>
                      </HStack>
                    )}
                    {selectedPayslip.deductions_breakdown && (
                      <>
                        {(selectedPayslip.deductions_breakdown.vale_amount ||
                          0) > 0 && (
                          <HStack justify="between">
                            <BodySmall>Vale:</BodySmall>
                            <BodySmall className="font-semibold text-red-600">
                              -
                              {formatCurrency(
                                selectedPayslip.deductions_breakdown
                                  .vale_amount || 0
                              )}
                            </BodySmall>
                          </HStack>
                        )}
                        {(selectedPayslip.deductions_breakdown
                          .sss_salary_loan || 0) > 0 && (
                          <HStack justify="between">
                            <BodySmall>SSS Salary Loan:</BodySmall>
                            <BodySmall className="font-semibold text-red-600">
                              -
                              {formatCurrency(
                                selectedPayslip.deductions_breakdown
                                  .sss_salary_loan || 0
                              )}
                            </BodySmall>
                          </HStack>
                        )}
                        {(selectedPayslip.deductions_breakdown
                          .pagibig_salary_loan || 0) > 0 && (
                          <HStack justify="between">
                            <BodySmall>Pag-IBIG Salary Loan:</BodySmall>
                            <BodySmall className="font-semibold text-red-600">
                              -
                              {formatCurrency(
                                selectedPayslip.deductions_breakdown
                                  .pagibig_salary_loan || 0
                              )}
                            </BodySmall>
                          </HStack>
                        )}
                      </>
                    )}
                    <div className="border-t pt-2 mt-2">
                      <HStack justify="between">
                        <BodySmall className="font-semibold">
                          Total Deductions:
                        </BodySmall>
                        <BodySmall className="font-semibold text-red-600">
                          -{formatCurrency(selectedPayslip.total_deductions)}
                        </BodySmall>
                      </HStack>
                    </div>
                  </VStack>
                </CardContent>
              </Card>

              {/* Net Pay */}
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="pt-6">
                  <HStack justify="between" align="center">
                    <H2 className="text-lg">Net Pay:</H2>
                    <H2 className="text-2xl text-emerald-600 font-bold">
                      {formatCurrency(selectedPayslip.net_pay)}
                    </H2>
                  </HStack>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}