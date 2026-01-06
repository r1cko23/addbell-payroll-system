"use client";

/**
 * BIR REPORTING PAGE
 * 
 * Generates BIR-compliant reports:
 * - BIR Form 2316 (Certificate of Compensation Payment/Tax Withheld) - Per Employee
 * - BIR Form 1604E (Annual Information Return) - Summary
 * - Alphalist of Employees (AOE) - Per Employee Breakdown
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/utils/format";
import { format, startOfYear, endOfYear } from "date-fns";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx-js-style";

interface EmployeeBIRData {
  employee_id: string;
  full_name: string;
  tin_number?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  address?: string | null;
  birth_date?: string | null;
  gender?: "male" | "female" | null;
  ytd_gross_compensation: number;
  ytd_taxable_compensation: number;
  ytd_tax_withheld: number;
  ytd_sss: number;
  ytd_philhealth: number;
  ytd_pagibig: number;
  ytd_thirteenth_month: number;
  payslip_count: number;
}

interface BIRSummary {
  total_employees: number;
  total_gross_compensation: number;
  total_taxable_compensation: number;
  total_tax_withheld: number;
  total_sss: number;
  total_philhealth: number;
  total_pagibig: number;
  total_thirteenth_month: number;
}

export default function BIRReportsPage() {
  const router = useRouter();
  const { isAdmin, isHR, loading: roleLoading } = useUserRole();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [employeeData, setEmployeeData] = useState<EmployeeBIRData[]>([]);
  const [summary, setSummary] = useState<BIRSummary | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  useEffect(() => {
    // Only allow admin and HR access
    if (!roleLoading && !isAdmin && !isHR) {
      router.push("/dashboard");
    }
  }, [roleLoading, isAdmin, isHR, router]);

  useEffect(() => {
    if (isAdmin || isHR) {
      fetchBIRData();
    }
  }, [year, isAdmin, isHR]);

  async function fetchBIRData() {
    setLoading(true);
    try {
      const yearStart = startOfYear(new Date(year, 0, 1));
      const yearEnd = endOfYear(new Date(year, 0, 1));

      // Fetch all payslips for the year
      const { data: payslips, error: payslipsError } = await supabase
        .from("payslips")
        .select(
          `
          id,
          employee_id,
          gross_pay,
          net_pay,
          deductions_breakdown,
          sss_amount,
          philhealth_amount,
          pagibig_amount,
          thirteenth_month_pay,
          period_start,
          period_end,
          employees(
            employee_id,
            full_name,
            tin_number,
            sss_number,
            philhealth_number,
            pagibig_number,
            address,
            birth_date,
            gender
          )
        `
        )
        .gte("period_start", yearStart.toISOString().split("T")[0])
        .lte("period_end", yearEnd.toISOString().split("T")[0])
        .eq("status", "paid"); // Only include paid payslips

      if (payslipsError) {
        throw payslipsError;
      }

      // Aggregate data per employee
      const employeeMap = new Map<string, EmployeeBIRData>();

      (payslips || []).forEach((payslip: any) => {
        const empId = payslip.employee_id;
        const employee = payslip.employees;

        if (!employeeMap.has(empId)) {
          employeeMap.set(empId, {
            employee_id: employee?.employee_id || "",
            full_name: employee?.full_name || "Unknown",
            tin_number: employee?.tin_number || null,
            sss_number: employee?.sss_number || null,
            philhealth_number: employee?.philhealth_number || null,
            pagibig_number: employee?.pagibig_number || null,
            address: employee?.address || null,
            birth_date: employee?.birth_date || null,
            gender: employee?.gender || null,
            ytd_gross_compensation: 0,
            ytd_taxable_compensation: 0,
            ytd_tax_withheld: 0,
            ytd_sss: 0,
            ytd_philhealth: 0,
            ytd_pagibig: 0,
            ytd_thirteenth_month: 0,
            payslip_count: 0,
          });
        }

        const empData = employeeMap.get(empId)!;
        const deductions = payslip.deductions_breakdown as any;

        // Accumulate YTD values
        empData.ytd_gross_compensation += Number(payslip.gross_pay || 0);
        empData.ytd_tax_withheld += Number(deductions?.tax || 0);
        empData.ytd_sss += Number(payslip.sss_amount || 0);
        empData.ytd_philhealth += Number(payslip.philhealth_amount || 0);
        empData.ytd_pagibig += Number(payslip.pagibig_amount || 0);
        empData.ytd_thirteenth_month += Number(payslip.thirteenth_month_pay || 0);
        empData.payslip_count += 1;

        // Taxable compensation = Gross - Government Contributions
        const govContributions =
          Number(payslip.sss_amount || 0) +
          Number(payslip.philhealth_amount || 0) +
          Number(payslip.pagibig_amount || 0);
        empData.ytd_taxable_compensation +=
          Number(payslip.gross_pay || 0) - govContributions;
      });

      const employees = Array.from(employeeMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

      // Calculate summary
      const summaryData: BIRSummary = {
        total_employees: employees.length,
        total_gross_compensation: employees.reduce(
          (sum, e) => sum + e.ytd_gross_compensation,
          0
        ),
        total_taxable_compensation: employees.reduce(
          (sum, e) => sum + e.ytd_taxable_compensation,
          0
        ),
        total_tax_withheld: employees.reduce(
          (sum, e) => sum + e.ytd_tax_withheld,
          0
        ),
        total_sss: employees.reduce((sum, e) => sum + e.ytd_sss, 0),
        total_philhealth: employees.reduce(
          (sum, e) => sum + e.ytd_philhealth,
          0
        ),
        total_pagibig: employees.reduce((sum, e) => sum + e.ytd_pagibig, 0),
        total_thirteenth_month: employees.reduce(
          (sum, e) => sum + e.ytd_thirteenth_month,
          0
        ),
      };

      setEmployeeData(employees);
      setSummary(summaryData);
    } catch (error) {
      console.error("Error fetching BIR data:", error);
    } finally {
      setLoading(false);
    }
  }

  function generateForm2316CSV(employee: EmployeeBIRData) {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Employer Information (from Privacy Notice)
    const employerName = "Green Pasture People Management Inc.";
    const employerAddress = "31st Floor, Unit 3101, AIC, Burgundy Empire Tower, ADB Ave, Ortigas Center, Pasig";
    const periodCovered = `January 1 - December 31, ${year}`;

    // Create worksheet data
    const wsData = [
      ["BIR FORM 2316 - CERTIFICATE OF COMPENSATION PAYMENT/TAX WITHHELD"],
      [`Taxable Year: ${year}`],
      [`Period Covered: ${periodCovered}`],
      [""],
      ["EMPLOYER INFORMATION:"],
      ["Employer Name:", employerName],
      ["Employer Address:", employerAddress],
      [""],
      ["EMPLOYEE INFORMATION:"],
      ["Employee ID:", employee.employee_id],
      ["Full Name:", employee.full_name],
      ["TIN:", employee.tin_number || "N/A"],
      ["SSS Number:", employee.sss_number || "N/A"],
      ["PhilHealth Number:", employee.philhealth_number || "N/A"],
      ["Pag-IBIG Number:", employee.pagibig_number || "N/A"],
      ["Address:", employee.address || "N/A"],
      ["Birth Date:", employee.birth_date ? format(new Date(employee.birth_date), "MMMM dd, yyyy") : "N/A"],
      ["Gender:", employee.gender ? (employee.gender === "male" ? "Male" : "Female") : "N/A"],
      [""],
      ["COMPENSATION AND TAX INFORMATION:"],
      ["Gross Compensation (YTD):", employee.ytd_gross_compensation],
      ["13th Month Pay (YTD):", employee.ytd_thirteenth_month],
      ["Taxable Compensation (YTD):", employee.ytd_taxable_compensation],
      ["Tax Withheld (YTD):", employee.ytd_tax_withheld],
      [""],
      ["GOVERNMENT CONTRIBUTIONS (YTD):"],
      ["SSS Contributions:", employee.ytd_sss],
      ["PhilHealth Contributions:", employee.ytd_philhealth],
      ["Pag-IBIG Contributions:", employee.ytd_pagibig],
      [""],
      ["ADDITIONAL INFORMATION:"],
      ["Total Payslips:", employee.payslip_count],
      ["Period Type:", "Bi-monthly"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = [
      { wch: 30 }, // Column A
      { wch: 30 }, // Column B
    ];

    // Style header row
    if (ws["A1"]) {
      ws["A1"].s = {
        font: { bold: true, sz: 14, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "4472C4" }, patternType: "solid" },
      };
    }

    // Style section headers
    [5, 10, 20, 26].forEach((row) => {
      const cell = ws[`A${row}`];
      if (cell) {
        cell.s = {
          font: { bold: true, sz: 12, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "E8F4F8" }, patternType: "solid" },
        };
      }
    });

    // Format currency cells
    const currencyRows = [21, 22, 23, 24, 27, 28, 29];
    currencyRows.forEach((row) => {
      const cell = ws[`B${row}`];
      if (cell && typeof cell.v === "number") {
        cell.z = "#,##0.00";
        cell.s = {
          numFmt: "#,##0.00",
          alignment: { horizontal: "right", vertical: "center" },
        };
      }
    });

    // Merge header row
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Form 2316");

    // Generate file
    XLSX.writeFile(wb, `BIR-2316-${employee.employee_id}-${year}.xlsx`);
  }

  function generateForm1604E() {
    if (!summary) return;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Employer Information
    const employerName = "Green Pasture People Management Inc.";
    const employerAddress = "31st Floor, Unit 3101, AIC, Burgundy Empire Tower, ADB Ave, Ortigas Center, Pasig";
    const periodCovered = `January 1 - December 31, ${year}`;

    // Create worksheet data
    const wsData = [
      ["BIR FORM 1604E - ANNUAL INFORMATION RETURN OF INCOME TAXES WITHHELD ON COMPENSATION"],
      [`Taxable Year: ${year}`],
      [`Period Covered: ${periodCovered}`],
      [""],
      ["EMPLOYER INFORMATION:"],
      ["Employer Name:", employerName],
      ["Employer Address:", employerAddress],
      [""],
      ["SUMMARY INFORMATION:"],
      ["Total Employees:", summary.total_employees],
      ["Total Gross Compensation (YTD):", summary.total_gross_compensation],
      ["Total 13th Month Pay (YTD):", summary.total_thirteenth_month],
      ["Total Taxable Compensation (YTD):", summary.total_taxable_compensation],
      ["Total Tax Withheld (YTD):", summary.total_tax_withheld],
      [""],
      ["GOVERNMENT CONTRIBUTIONS (YTD):"],
      ["Total SSS Contributions:", summary.total_sss],
      ["Total PhilHealth Contributions:", summary.total_philhealth],
      ["Total Pag-IBIG Contributions:", summary.total_pagibig],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = [
      { wch: 30 }, // Column A
      { wch: 30 }, // Column B
    ];

    // Style header row
    if (ws["A1"]) {
      ws["A1"].s = {
        font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "4472C4" }, patternType: "solid" },
      };
    }

    // Style section headers
    [5, 9, 15].forEach((row) => {
      const cell = ws[`A${row}`];
      if (cell) {
        cell.s = {
          font: { bold: true, sz: 12, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "E8F4F8" }, patternType: "solid" },
        };
      }
    });

    // Format currency cells
    const currencyRows = [10, 11, 12, 13, 16, 17, 18];
    currencyRows.forEach((row) => {
      const cell = ws[`B${row}`];
      if (cell && typeof cell.v === "number") {
        cell.z = "#,##0.00";
        cell.s = {
          numFmt: "#,##0.00",
          alignment: { horizontal: "right", vertical: "center" },
        };
      }
    });

    // Merge header row
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Form 1604E");

    // Generate file
    XLSX.writeFile(wb, `BIR-1604E-${year}.xlsx`);
  }

  function generateAlphalist() {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create header row
    const headers = [
      "Employee ID",
      "Full Name",
      "TIN",
      "SSS Number",
      "PhilHealth Number",
      "Pag-IBIG Number",
      "Address",
      "Birth Date",
      "Gender",
      "Gross Compensation (YTD)",
      "13th Month Pay (YTD)",
      "Taxable Compensation (YTD)",
      "Tax Withheld (YTD)",
      "SSS Contributions (YTD)",
      "PhilHealth Contributions (YTD)",
      "Pag-IBIG Contributions (YTD)",
      "Payslip Count",
    ];

    // Create data rows
    const rows = employeeData.map((emp) => [
      emp.employee_id,
      emp.full_name,
      emp.tin_number || "",
      emp.sss_number || "",
      emp.philhealth_number || "",
      emp.pagibig_number || "",
      emp.address || "",
      emp.birth_date ? format(new Date(emp.birth_date), "MM/dd/yyyy") : "",
      emp.gender ? (emp.gender === "male" ? "Male" : "Female") : "",
      emp.ytd_gross_compensation,
      emp.ytd_thirteenth_month,
      emp.ytd_taxable_compensation,
      emp.ytd_tax_withheld,
      emp.ytd_sss,
      emp.ytd_philhealth,
      emp.ytd_pagibig,
      emp.payslip_count,
    ]);

    // Combine headers and rows
    const wsData = [headers, ...rows];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = [
      { wch: 12 }, // Employee ID
      { wch: 25 }, // Full Name
      { wch: 15 }, // TIN
      { wch: 15 }, // SSS Number
      { wch: 15 }, // PhilHealth Number
      { wch: 15 }, // Pag-IBIG Number
      { wch: 30 }, // Address
      { wch: 12 }, // Birth Date
      { wch: 10 }, // Gender
      { wch: 20 }, // Gross Compensation
      { wch: 18 }, // 13th Month Pay
      { wch: 20 }, // Taxable Compensation
      { wch: 15 }, // Tax Withheld
      { wch: 18 }, // SSS Contributions
      { wch: 18 }, // PhilHealth Contributions
      { wch: 18 }, // Pag-IBIG Contributions
      { wch: 12 }, // Payslip Count
    ];

    // Style header row
    for (let C = 0; C < headers.length; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" }, patternType: "solid" },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    }

    // Format currency columns (columns J, K, L, M, N, O, P - indices 9-15)
    const currencyColumns = [9, 10, 11, 12, 13, 14, 15];
    for (let R = 1; R <= rows.length; ++R) {
      currencyColumns.forEach((col) => {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: col });
        if (ws[cellAddress] && typeof ws[cellAddress].v === "number") {
          ws[cellAddress].z = "#,##0.00";
          ws[cellAddress].s = {
            numFmt: "#,##0.00",
            alignment: { horizontal: "right" },
          };
        }
      });
    }

    // Format data rows with borders
    for (let R = 1; R <= rows.length; ++R) {
      for (let C = 0; C < headers.length; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.border = {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        };
        ws[cellAddress].s.alignment = ws[cellAddress].s.alignment || { vertical: "top" };
      }
    }

    // Freeze header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Alphalist");

    // Generate file
    XLSX.writeFile(wb, `BIR-Alphalist-${year}.xlsx`);
  }

  if (roleLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin && !isHR) {
    return null;
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        {/* Header */}
        <VStack gap="2" align="start">
          <H1>BIR Reports</H1>
          <BodySmall>
            Generate BIR-compliant reports for tax filing and compliance
          </BodySmall>
        </VStack>

        {/* Year Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Report Year</CardTitle>
            <CardDescription>Select the year for BIR reporting</CardDescription>
          </CardHeader>
          <CardContent>
            <HStack gap="4" align="end">
              <VStack gap="2" align="start" className="flex-1">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                  min="2020"
                  max={new Date().getFullYear() + 1}
                  className="w-full sm:w-48"
                />
              </VStack>
              <Button onClick={fetchBIRData} disabled={loading}>
                <Icon name="MagnifyingGlass" size={IconSizes.sm} />
                Load Data
              </Button>
            </HStack>
          </CardContent>
        </Card>

        {/* Summary Card */}
        {summary && (
          <CardSection title="BIR Form 1604E - Annual Summary" description={`Year ${year}`}>
            <VStack gap="4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <VStack gap="1" align="start">
                  <Caption className="text-muted-foreground">Total Employees</Caption>
                  <BodySmall className="text-xl font-semibold">
                    {summary.total_employees}
                  </BodySmall>
                </VStack>
                <VStack gap="1" align="start">
                  <Caption className="text-muted-foreground">Total Gross Compensation</Caption>
                  <BodySmall className="text-xl font-semibold">
                    {formatCurrency(summary.total_gross_compensation)}
                  </BodySmall>
                </VStack>
                <VStack gap="1" align="start">
                  <Caption className="text-muted-foreground">13th Month Pay (YTD)</Caption>
                  <BodySmall className="text-xl font-semibold">
                    {formatCurrency(summary.total_thirteenth_month)}
                  </BodySmall>
                </VStack>
                <VStack gap="1" align="start">
                  <Caption className="text-muted-foreground">Total Tax Withheld</Caption>
                  <BodySmall className="text-xl font-semibold">
                    {formatCurrency(summary.total_tax_withheld)}
                  </BodySmall>
                </VStack>
                <VStack gap="1" align="start">
                  <Caption className="text-muted-foreground">Total Taxable Compensation</Caption>
                  <BodySmall className="text-xl font-semibold">
                    {formatCurrency(summary.total_taxable_compensation)}
                  </BodySmall>
                </VStack>
              </div>
              <Button onClick={generateForm1604E} className="w-full sm:w-auto">
                <Icon name="Download" size={IconSizes.sm} />
                Download BIR Form 1604E
              </Button>
            </VStack>
          </CardSection>
        )}

        {/* Export Options */}
        <CardSection title="Export Reports" description="Generate BIR-compliant reports">
          <VStack gap="3">
            <Button onClick={generateAlphalist} className="w-full sm:w-auto" variant="secondary">
              <Icon name="FileCsv" size={IconSizes.sm} />
              Download Alphalist of Employees (AOE)
            </Button>
            <BodySmall className="text-muted-foreground">
              Generates a CSV file with per-employee breakdown for the selected year
            </BodySmall>
          </VStack>
        </CardSection>

        {/* Employee List */}
        {employeeData.length > 0 && (
          <CardSection
            title="Employee BIR Data"
            description={`${employeeData.length} employees with payslip data for ${year}`}
          >
            <div className="space-y-2">
              {employeeData.map((employee) => (
                <Card key={employee.employee_id} className="hover:bg-accent transition-colors">
                  <CardContent className="p-4">
                    <HStack justify="between" align="center">
                      <VStack gap="1" align="start">
                        <BodySmall className="font-semibold">
                          {employee.full_name}
                        </BodySmall>
                        <Caption>
                          ID: {employee.employee_id}
                          {employee.tin_number && ` | TIN: ${employee.tin_number}`} |{" "}
                          {employee.payslip_count} payslip(s)
                        </Caption>
                      </VStack>
                      <VStack gap="2" align="end">
                        <HStack gap="4">
                          <VStack gap="1" align="end">
                            <Caption className="text-muted-foreground">Gross</Caption>
                            <BodySmall className="font-semibold">
                              {formatCurrency(employee.ytd_gross_compensation)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end">
                            <Caption className="text-muted-foreground">13th Month</Caption>
                            <BodySmall className="font-semibold">
                              {formatCurrency(employee.ytd_thirteenth_month)}
                            </BodySmall>
                          </VStack>
                          <VStack gap="1" align="end">
                            <Caption className="text-muted-foreground">Tax</Caption>
                            <BodySmall className="font-semibold">
                              {formatCurrency(employee.ytd_tax_withheld)}
                            </BodySmall>
                          </VStack>
                        </HStack>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateForm2316CSV(employee)}
                        >
                          <Icon name="Download" size={IconSizes.xs} />
                          Form 2316
                        </Button>
                      </VStack>
                    </HStack>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardSection>
        )}

        {employeeData.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <BodySmall className="text-muted-foreground">
                No payslip data found for {year}. Please ensure payslips are marked as "paid" for
                them to appear in BIR reports.
              </BodySmall>
            </CardContent>
          </Card>
        )}
      </VStack>
    </DashboardLayout>
  );
}

