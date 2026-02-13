"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type LedgerRow = {
  id: string;
  source_type: "purchase_order_item" | "manpower" | "expense" | "adjustment";
  source_id: string;
  ledger_date: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type ProjectInfo = {
  id: string;
  project_code: string | null;
  project_name: string;
  contract_amount: number | null;
  budget_amount: number | null;
  project_status: string | null;
};

export default function ProjectProfitabilityDetailPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { canAccessSalaryInfo, loading: roleLoading } = useUserRole();

  const projectId = params.projectId;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!roleLoading && !canAccessSalaryInfo) {
      toast.error("You do not have permission to access this page.");
      router.push("/dashboard");
    }
  }, [canAccessSalaryInfo, roleLoading, router]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, project_code, project_name, contract_amount, budget_amount, project_status")
        .eq("id", projectId)
        .single();
      if (projectError) throw projectError;
      setProject(projectData as ProjectInfo);

      let ledgerQuery = supabase
        .from("project_cost_ledger")
        .select("id, source_type, source_id, ledger_date, amount, status, notes, created_at")
        .eq("project_id", projectId)
        .order("ledger_date", { ascending: false });

      if (start) ledgerQuery = ledgerQuery.gte("ledger_date", start);
      if (end) ledgerQuery = ledgerQuery.lte("ledger_date", end);

      const { data: ledgerData, error: ledgerError } = await ledgerQuery;
      if (ledgerError) throw ledgerError;

      setLedgerRows((ledgerData || []) as LedgerRow[]);
    } catch (error: any) {
      toast.error(`Failed to load project drilldown: ${error.message}`);
      setProject(null);
      setLedgerRows([]);
    } finally {
      setLoading(false);
    }
  }, [end, projectId, start, supabase]);

  useEffect(() => {
    if (!roleLoading && canAccessSalaryInfo) {
      loadData();
    }
  }, [canAccessSalaryInfo, roleLoading, loadData]);

  const filteredRows = useMemo(() => {
    return ledgerRows.filter((row) => {
      const sourceMatches = sourceTypeFilter === "all" || row.source_type === sourceTypeFilter;
      const statusMatches = statusFilter === "all" || row.status === statusFilter;
      return sourceMatches && statusMatches;
    });
  }, [ledgerRows, sourceTypeFilter, statusFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const amount = Number(row.amount || 0);
        acc.total += amount;
        if (row.source_type === "manpower") acc.manpower += amount;
        else if (row.source_type === "purchase_order_item") acc.material += amount;
        else acc.other += amount;
        return acc;
      },
      { manpower: 0, material: 0, other: 0, total: 0 }
    );
  }, [filteredRows]);

  const monthlyTrend = useMemo(() => {
    const bucket = new Map<string, { manpower: number; material: number; other: number; total: number }>();
    for (const row of filteredRows) {
      const monthKey = String(row.ledger_date || "").slice(0, 7);
      const current = bucket.get(monthKey) || { manpower: 0, material: 0, other: 0, total: 0 };
      const amount = Number(row.amount || 0);
      current.total += amount;
      if (row.source_type === "manpower") current.manpower += amount;
      else if (row.source_type === "purchase_order_item") current.material += amount;
      else current.other += amount;
      bucket.set(monthKey, current);
    }
    return Array.from(bucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({ month, ...values }));
  }, [filteredRows]);

  const margin = useMemo(() => {
    const contract = Number(project?.contract_amount || 0);
    const value = contract - totals.total;
    const pct = contract > 0 ? (value / contract) * 100 : 0;
    return { value, pct };
  }, [project?.contract_amount, totals.total]);

  const exportDetailCSV = useCallback(() => {
    if (filteredRows.length === 0) {
      toast.error("No detail rows to export.");
      return;
    }

    const headers = ["Date", "Source Type", "Status", "Notes", "Amount"];
    let csv = `${headers.join(",")}\n`;

    filteredRows.forEach((row) => {
      const values = [
        row.ledger_date || "",
        row.source_type || "",
        row.status || "",
        row.notes || "",
        Number(row.amount || 0).toFixed(2),
      ];
      csv += `${values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-cost-timeline-${project?.project_code || projectId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Detail CSV exported.");
  }, [filteredRows, project?.project_code, projectId]);

  const exportDetailPDF = useCallback(() => {
    if (filteredRows.length === 0) {
      toast.error("No detail rows to export.");
      return;
    }

    const doc = new jsPDF("landscape", "mm", "a4");
    doc.setFontSize(14);
    doc.text(`Project Cost Timeline - ${project?.project_name || projectId}`, 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Filters: source=${sourceTypeFilter}, status=${statusFilter}${start && end ? ` | period=${start} to ${end}` : ""}`,
      14,
      20
    );

    autoTable(doc, {
      startY: 24,
      head: [["Date", "Source Type", "Status", "Notes", "Amount"]],
      body: filteredRows.map((row) => [
        row.ledger_date || "-",
        row.source_type || "-",
        row.status || "-",
        row.notes || "-",
        formatCurrency(row.amount || 0),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        3: { cellWidth: 130 },
        4: { halign: "right" },
      },
      headStyles: { fillColor: [50, 50, 50], textColor: 255 },
    });

    doc.save(`project-cost-timeline-${project?.project_code || projectId}.pdf`);
    toast.success("Detail PDF exported.");
  }, [end, filteredRows, project?.project_code, project?.project_name, projectId, sourceTypeFilter, start, statusFilter]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Loading project drilldown...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">{project?.project_name || "Project"}</h2>
            <p className="text-sm text-muted-foreground">
              {project?.project_code || "No code"} • {project?.project_status || "N/A"}
              {start && end ? ` • Period ${start} to ${end}` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/project-profitability")}>
            Back to Report
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contract</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">{formatCurrency(project?.contract_amount || 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Manpower Cost</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">{formatCurrency(totals.manpower)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Material Cost</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">{formatCurrency(totals.material)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Other Cost</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">{formatCurrency(totals.other)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Margin</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">
              {formatCurrency(margin.value)} ({margin.pct.toFixed(2)}%)
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <CardTitle className="text-sm">Cost Timeline</CardTitle>
              <div className="text-xs text-muted-foreground">
                Showing {filteredRows.length} of {ledgerRows.length} entries
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-2 border-b p-3">
              <div className="w-[200px]">
                <div className="mb-1 text-xs text-muted-foreground">Source Type</div>
                <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All source types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All source types</SelectItem>
                    <SelectItem value="manpower">Manpower</SelectItem>
                    <SelectItem value="purchase_order_item">Purchase Order Item</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[160px]">
                <div className="mb-1 text-xs text-muted-foreground">Status</div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="reversed">Reversed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex items-end gap-2">
                <Button variant="outline" size="sm" onClick={exportDetailPDF}>
                  Export PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportDetailCSV}>
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No cost entries found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.ledger_date}</TableCell>
                        <TableCell>{row.source_type}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell className="max-w-[440px] truncate" title={row.notes || ""}>
                          {row.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(row.amount || 0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Cost Trend</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Manpower</TableHead>
                    <TableHead className="text-right">Material</TableHead>
                    <TableHead className="text-right">Other</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyTrend.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No monthly trend data for selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyTrend.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{row.month}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.manpower)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.material)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.other)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
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