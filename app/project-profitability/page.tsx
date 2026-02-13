"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ProfitabilityRow = {
  project_id: string;
  project_code: string | null;
  project_name: string;
  client_name: string | null;
  project_status: string | null;
  contract_amount: number;
  budget_amount: number;
  period_labor_cost: number;
  period_material_cost: number;
  period_other_cost: number;
  period_total_cost: number;
  all_time_labor_cost: number;
  all_time_material_cost: number;
  all_time_other_cost: number;
  all_time_total_cost: number;
  period_margin: number;
  period_margin_pct: number;
  all_time_margin: number;
  all_time_margin_pct: number;
};

function toInputDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function ProjectProfitabilityPage() {
  const router = useRouter();
  const supabase = createClient();
  const { canAccessSalaryInfo, loading: roleLoading } = useUserRole();

  const [cutoffStart, setCutoffStart] = useState<string>(
    toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [cutoffEnd, setCutoffEnd] = useState<string>(
    toInputDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  );
  const [rows, setRows] = useState<ProfitabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!roleLoading && !canAccessSalaryInfo) {
      toast.error("You do not have permission to access this page.");
      router.push("/dashboard");
    }
  }, [canAccessSalaryInfo, roleLoading, router]);

  const loadData = useCallback(async () => {
    if (!cutoffStart || !cutoffEnd) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_project_profitability_report",
        {
          p_cutoff_start: cutoffStart,
          p_cutoff_end: cutoffEnd,
          p_include_inactive: false,
        } as never
      );
      if (error) throw error;
      setRows((data || []) as ProfitabilityRow[]);
    } catch (error: any) {
      toast.error(`Failed to load profitability report: ${error.message}`);
      setRows([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [cutoffEnd, cutoffStart, supabase]);

  useEffect(() => {
    if (!roleLoading && canAccessSalaryInfo) {
      loadData();
    }
  }, [canAccessSalaryInfo, roleLoading, loadData]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.contract += Number(row.contract_amount || 0);
        acc.periodCost += Number(row.period_total_cost || 0);
        acc.allTimeCost += Number(row.all_time_total_cost || 0);
        acc.periodMargin += Number(row.period_margin || 0);
        acc.allTimeMargin += Number(row.all_time_margin || 0);
        return acc;
      },
      { contract: 0, periodCost: 0, allTimeCost: 0, periodMargin: 0, allTimeMargin: 0 }
    );
  }, [rows]);

  const exportToCSV = useCallback(() => {
    if (rows.length === 0) {
      toast.error("No data to export.");
      return;
    }

    const headers = [
      "Project Code",
      "Project Name",
      "Client",
      "Status",
      "Contract Amount",
      "Period Labor",
      "Period Material",
      "Period Other",
      "Period Total",
      "Period Margin",
      "Period Margin %",
      "All-Time Total Cost",
      "All-Time Margin",
      "All-Time Margin %",
    ];

    let csv = `${headers.join(",")}\n`;
    rows.forEach((row) => {
      const values = [
        row.project_code || "",
        row.project_name || "",
        row.client_name || "",
        row.project_status || "",
        Number(row.contract_amount || 0).toFixed(2),
        Number(row.period_labor_cost || 0).toFixed(2),
        Number(row.period_material_cost || 0).toFixed(2),
        Number(row.period_other_cost || 0).toFixed(2),
        Number(row.period_total_cost || 0).toFixed(2),
        Number(row.period_margin || 0).toFixed(2),
        Number(row.period_margin_pct || 0).toFixed(2),
        Number(row.all_time_total_cost || 0).toFixed(2),
        Number(row.all_time_margin || 0).toFixed(2),
        Number(row.all_time_margin_pct || 0).toFixed(2),
      ];
      csv += `${values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-profitability-${cutoffStart}-to-${cutoffEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  }, [cutoffEnd, cutoffStart, rows]);

  const exportToPDF = useCallback(() => {
    if (rows.length === 0) {
      toast.error("No data to export.");
      return;
    }

    const doc = new jsPDF("landscape", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Project Profitability Report", 14, 14);
    doc.setFontSize(9);
    doc.text(`Period: ${cutoffStart} to ${cutoffEnd}`, 14, 20);

    const tableRows = rows.map((row) => [
      row.project_code || "-",
      row.project_name || "-",
      row.client_name || "-",
      formatCurrency(row.contract_amount || 0),
      formatCurrency(row.period_total_cost || 0),
      formatCurrency(row.period_margin || 0),
      `${Number(row.period_margin_pct || 0).toFixed(2)}%`,
      formatCurrency(row.all_time_total_cost || 0),
      `${Number(row.all_time_margin_pct || 0).toFixed(2)}%`,
    ]);

    autoTable(doc, {
      startY: 24,
      head: [[
        "Code",
        "Project",
        "Client",
        "Contract",
        "Period Cost",
        "Period Margin",
        "Period Margin %",
        "All-Time Cost",
        "All-Time Margin %",
      ]],
      body: tableRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50], textColor: 255 },
    });

    doc.save(`project-profitability-${cutoffStart}-to-${cutoffEnd}.pdf`);
    toast.success("PDF exported.");
  }, [cutoffEnd, cutoffStart, rows]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Loading project profitability...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold">Project Profitability</h2>
          <div className="flex flex-wrap items-end gap-2 justify-end">
            <div>
              <Label className="mb-1 text-xs">Cutoff Start</Label>
              <Input
                type="date"
                value={cutoffStart}
                onChange={(e) => setCutoffStart(e.target.value)}
                className="h-9 w-[160px]"
              />
            </div>
            <div>
              <Label className="mb-1 text-xs">Cutoff End</Label>
              <Input
                type="date"
                value={cutoffEnd}
                onChange={(e) => setCutoffEnd(e.target.value)}
                className="h-9 w-[160px]"
              />
            </div>
            <Button onClick={loadData} disabled={refreshing} size="sm">
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm">
              Export PDF
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Contract Value</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">
              {formatCurrency(totals.contract)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Period Total Cost</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">
              {formatCurrency(totals.periodCost)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Period Margin</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">
              {formatCurrency(totals.periodMargin)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Contract</TableHead>
                    <TableHead className="text-right">Period Labor</TableHead>
                    <TableHead className="text-right">Period Material</TableHead>
                    <TableHead className="text-right">Period Other</TableHead>
                    <TableHead className="text-right">Period Total</TableHead>
                    <TableHead className="text-right">Period Margin %</TableHead>
                    <TableHead className="text-right">All-Time Total Cost</TableHead>
                    <TableHead className="text-right">All-Time Margin %</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-6 text-center text-sm text-muted-foreground">
                        No projects found for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.project_id}>
                        <TableCell>
                          <div className="font-medium">{row.project_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.project_code || "No code"} • {row.project_status || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>{row.client_name || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.contract_amount || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.period_labor_cost || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.period_material_cost || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.period_other_cost || 0)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.period_total_cost || 0)}
                        </TableCell>
                        <TableCell className="text-right">{Number(row.period_margin_pct || 0).toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.all_time_total_cost || 0)}</TableCell>
                        <TableCell className="text-right">{Number(row.all_time_margin_pct || 0).toFixed(2)}%</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/project-profitability/${row.project_id}?start=${cutoffStart}&end=${cutoffEnd}`
                              )
                            }
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
