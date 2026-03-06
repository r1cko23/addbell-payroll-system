"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface DepartmentStat { name: string; count: number; }
interface RecentEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  employment_type: string;
  hire_date: string;
  employment_status: string;
  departments: { name: string } | null;
}

export default function HRDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [deptStats, setDeptStats] = useState<DepartmentStat[]>([]);
  const [recentHires, setRecentHires] = useState<RecentEmployee[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<{ type: string; count: number }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [
        { count: total },
        { count: active },
        { data: allEmps },
        { data: recent },
      ] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("employment_status", "active"),
        supabase.from("employees").select("employment_type, departments:department_id ( name )").eq("employment_status", "active"),
        supabase.from("employees").select("id, employee_code, first_name, last_name, employment_type, hire_date, employment_status, departments:department_id ( name )")
          .order("hire_date", { ascending: false }).limit(10),
      ]);

      setTotalEmployees(total || 0);
      setActiveEmployees(active || 0);
      setRecentHires((recent || []) as unknown as RecentEmployee[]);

      const deptMap = new Map<string, number>();
      const typeMap = new Map<string, number>();
      (allEmps || []).forEach((emp: any) => {
        const dept = emp.departments?.name || "Unassigned";
        deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
        const type = emp.employment_type || "unknown";
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
      });

      setDeptStats(Array.from(deptMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
      setTypeBreakdown(Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));
    } catch (error: any) {
      console.error("HR Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const inactiveEmployees = totalEmployees - activeEmployees;

  return (
    <VStack gap="8" className="w-full pb-16">
      <VStack gap="2" align="start">
        <H1>Workforce Overview</H1>
        <BodySmall>Employee statistics and recent activity.</BodySmall>
      </VStack>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Employees</CardDescription></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEmployees}</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span className="text-emerald-600 font-medium">{activeEmployees} active</span>
              <span>{inactiveEmployees} inactive</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Departments</CardDescription></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{deptStats.length}</p>
            <p className="text-xs text-muted-foreground mt-1">with assigned employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Employment Types</CardDescription></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mt-1">
              {typeBreakdown.map((t) => (
                <Badge key={t.type} variant="outline" className="capitalize text-xs">
                  {t.type}: {t.count}
                </Badge>
              ))}
              {typeBreakdown.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown & Recent Hires */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSection title="By Department" description="Active employee count per department.">
          {deptStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No department data.</p>
          ) : (
            <div className="space-y-2">
              {deptStats.map((d) => (
                <div key={d.name} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm font-medium">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-200 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (d.count / Math.max(activeEmployees, 1)) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-mono w-6 text-right">{d.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardSection>

        <CardSection title="Recent Hires" description="Latest employees by hire date.">
          {recentHires.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No employees yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentHires.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <Link href={`/employees/${emp.id}`} className="text-primary hover:underline text-sm font-medium">
                          {emp.first_name} {emp.last_name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono">{emp.employee_code}</p>
                      </TableCell>
                      <TableCell className="text-sm">{emp.departments?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{format(new Date(emp.hire_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${
                          emp.employment_status === "active" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-800"
                        }`}>
                          {emp.employment_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Link href="/employees"><Button variant="ghost" size="sm">View All Employees →</Button></Link>
          </div>
        </CardSection>
      </div>
    </VStack>
  );
}
