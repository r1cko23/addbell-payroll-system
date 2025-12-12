"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { toast } from "sonner";

type OTRequest = {
  id: string;
  employee_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected";
  account_manager_id?: string | null;
  created_at: string;
  employees?: { full_name: string; employee_id: string };
};

export default function OvertimeApprovalPage() {
  const supabase = createClient();
  const { isAdmin, role, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OTRequest | null>(null);
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {}
  );

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday

  const loadRequests = async () => {
    setLoading(true);

    // Ensure weekEnd includes the full day
    const weekEndInclusive = new Date(weekEnd);
    weekEndInclusive.setHours(23, 59, 59, 999);

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEndInclusive, "yyyy-MM-dd");

    let query = supabase
      .from("overtime_requests")
      .select(
        `
        *,
        employees (
          full_name,
          employee_id
        )
      `
      )
      .gte("ot_date", weekStartStr)
      .lte("ot_date", weekEndStr)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (selectedEmployee !== "all") {
      query = query.eq("employee_id", selectedEmployee);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading OT requests", error);
      toast.error("Failed to load OT requests");
    } else {
      setRequests((data || []) as OTRequest[]);

      // Load approver names for approved requests
      const approverIds = Array.from(
        new Set(
          (data || [])
            .map((r) => r.account_manager_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      if (approverIds.length > 0) {
        loadApproverNames(approverIds);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_id, full_name")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Failed to load employees", error);
      return;
    }

    setEmployees(data || []);
  }

  async function loadApproverNames(ids: string[]) {
    if (ids.length === 0) return;

    // Primary: users table (auth profiles), fallback: employees
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", ids);

    if (userData && !userError) {
      setApproverNames((prev) => {
        const next = { ...prev };
        userData.forEach((row) => {
          next[row.id] = row.full_name || row.email || row.id;
        });
        return next;
      });
      return;
    }

    const { data: empData, error: empError } = await supabase
      .from("employees")
      .select("id, full_name, email")
      .in("id", ids);

    if (empError || !empData) return;

    setApproverNames((prev) => {
      const next = { ...prev };
      empData.forEach((row) => {
        next[row.id] = row.full_name || row.email || row.id;
      });
      return next;
    });
  }

  useEffect(() => {
    loadRequests();
  }, [selectedWeek, statusFilter, selectedEmployee]);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("approve_overtime_request", {
      p_request_id: id,
    });
    if (error) {
      toast.error(error.message || "Failed to approve OT");
    } else {
      toast.success("OT approved and offset hours added");
      loadRequests();
    }
    setActioningId(null);
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("reject_overtime_request", {
      p_request_id: id,
      p_reason: null,
    });
    if (error) {
      toast.error(error.message || "Failed to reject OT");
    } else {
      toast.success("OT rejected");
      loadRequests();
    }
    setActioningId(null);
  };

  if (roleLoading) {
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

  if (role !== "account_manager" && role !== "admin") {
    return (
      <DashboardLayout>
        <VStack gap="4" className="p-8">
          <BodySmall>
            Only Account Managers and Admins can access OT approvals.
          </BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <H1>OT Approvals</H1>
          <BodySmall>
            Approve or reject employee-filed OT. Approved hours convert 1:1 to
            off-setting credits.
          </BodySmall>
        </VStack>

        {/* Filters */}
        <Card className="w-full">
          <CardContent className="p-4 sm:p-6 w-full">
            <div className="flex flex-col gap-4 md:flex-row md:items-center w-full">
              {/* Week Navigation */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 items-center sm:items-center flex-shrink-0 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
                    className="flex-shrink-0"
                  >
                    <Icon name="CaretLeft" size={IconSizes.sm} />
                  </Button>
                  <Caption className="min-w-[180px] sm:min-w-[200px] text-center font-medium text-xs sm:text-sm">
                    {format(weekStart, "MMM d")} -{" "}
                    {format(weekEnd, "MMM d, yyyy")}
                  </Caption>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
                    className="flex-shrink-0"
                  >
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedWeek(new Date())}
                  className="w-full sm:w-auto"
                >
                  Today
                </Button>
              </div>

              {/* Spacer to push filters to the right (hidden on mobile) */}
              <div className="hidden md:block flex-1 min-w-0" />

              {/* Filters Section */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                {/* Status Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="text-muted-foreground flex-shrink-0 hidden sm:block"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full sm:w-[160px] lg:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Employee Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="text-muted-foreground flex-shrink-0 hidden sm:block"
                  />
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="flex h-10 w-full sm:w-[200px] lg:w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Employees</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <CardSection>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon
                name="ArrowsClockwise"
                size={IconSizes.lg}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : requests.length === 0 ? (
            <BodySmall>No overtime requests yet.</BodySmall>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {requests.map((req) => (
                <Card
                  key={req.id}
                  className="h-full min-h-[200px] shadow-sm border-border bg-white"
                >
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <HStack
                      justify="between"
                      align="start"
                      className="flex-col md:flex-row gap-3"
                    >
                      <VStack gap="2" align="start" className="flex-1">
                        <p className="font-semibold text-foreground leading-tight">
                          {req.employees?.full_name || "Unknown"} (
                          {req.employees?.employee_id || "—"})
                        </p>
                        <BodySmall className="text-muted-foreground">
                          {format(new Date(req.ot_date), "MMM d, yyyy")} ·{" "}
                          {req.start_time} - {req.end_time} · {req.total_hours}h
                        </BodySmall>
                        {req.reason && (
                          <Caption className="line-clamp-2" title={req.reason}>
                            {req.reason}
                          </Caption>
                        )}
                        {req.attachment_url && (
                          <a
                            href={req.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-600 underline"
                          >
                            Attachment
                          </a>
                        )}
                        {req.status === "approved" && (
                          <VStack
                            gap="1"
                            align="start"
                            className="mt-1 text-xs text-gray-600"
                          >
                            <p className="font-semibold text-foreground">
                              Approved by Account Manager
                            </p>
                            <Caption>
                              {req.account_manager_id
                                ? approverNames[req.account_manager_id] ||
                                  "Not captured"
                                : "Not captured"}
                            </Caption>
                          </VStack>
                        )}
                      </VStack>
                      <HStack gap="2" align="center">
                        <Badge
                          variant="outline"
                          className={
                            req.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : req.status === "rejected"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {req.status.toUpperCase()}
                        </Badge>
                        {req.status === "pending" &&
                          (role === "account_manager" || role === "admin") && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(req.id)}
                                disabled={actioningId === req.id}
                              >
                                <Icon name="Check" size={IconSizes.sm} />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleReject(req.id)}
                                disabled={actioningId === req.id}
                              >
                                <Icon name="X" size={IconSizes.sm} />
                                Reject
                              </Button>
                            </>
                          )}
                      </HStack>
                    </HStack>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardSection>
      </VStack>
    </DashboardLayout>
  );
}
