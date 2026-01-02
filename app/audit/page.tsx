"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { VStack, HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  formatAuditValue,
  getFieldLabel,
  getTableDisplayConfig,
} from "@/utils/audit-formatter";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

// Component to display UPDATE changes
function AuditChangesDisplay({
  oldValues,
  newValues,
  tableName,
}: {
  oldValues: any;
  newValues: any;
  tableName: string;
}) {
  const changedFields = Object.keys(newValues || {}).filter(
    (key) => oldValues?.[key] !== newValues?.[key]
  );

  if (changedFields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No changes detected
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Changes ({changedFields.length})
      </div>
      <div className="space-y-2">
        {changedFields.map((field) => {
          const oldVal = oldValues?.[field];
          const newVal = newValues?.[field];
          const label = getFieldLabel(field, tableName);
          const formattedOld = formatAuditValue(oldVal, field, tableName);
          const formattedNew = formatAuditValue(newVal, field, tableName);

          return (
            <div
              key={field}
              className="flex items-start gap-3 p-2 bg-muted/50 rounded-md border"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {label}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-600 line-through">
                      {formattedOld}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">→</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-green-600">
                      {formattedNew}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Component to display INSERT operations
function AuditInsertDisplay({
  values,
  tableName,
}: {
  values: any;
  tableName: string;
}) {
  const fields = Object.keys(values || {});
  const config = getTableDisplayConfig(tableName);

  // Show primary fields first, then others
  const sortedFields = [
    ...fields.filter((f) => config.primaryFields.includes(f)),
    ...fields.filter((f) => !config.primaryFields.includes(f)),
  ];

  return (
    <div className="space-y-2 mt-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Created Record
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sortedFields.slice(0, 8).map((field) => {
          const value = values[field];
          const label = getFieldLabel(field, tableName);
          const formatted = formatAuditValue(value, field, tableName);

          return (
            <div key={field} className="text-sm">
              <span className="text-muted-foreground text-xs">{label}:</span>{" "}
              <span className="font-medium">{formatted}</span>
            </div>
          );
        })}
      </div>
      {sortedFields.length > 8 && (
        <div className="text-xs text-muted-foreground italic">
          +{sortedFields.length - 8} more fields
        </div>
      )}
    </div>
  );
}

// Component to display DELETE operations
function AuditDeleteDisplay({
  values,
  tableName,
}: {
  values: any;
  tableName: string;
}) {
  const config = getTableDisplayConfig(tableName);
  const primaryFields = config.primaryFields.slice(0, 4);

  return (
    <div className="space-y-2 mt-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Deleted Record
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {primaryFields.map((field) => {
          const value = values?.[field];
          if (value === undefined) return null;
          const label = getFieldLabel(field, tableName);
          const formatted = formatAuditValue(value, field, tableName);

          return (
            <div key={field} className="text-sm">
              <span className="text-muted-foreground text-xs">{label}:</span>{" "}
              <span className="font-medium">{formatted}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EmployeeFirstLogin {
  id: string;
  employee_id: string;
  first_login_time: string;
  first_logout_time: string | null;
  ip_address: string | null;
  device_info: string | null;
  user_agent: string | null;
  browser_name: string | null;
  browser_version: string | null;
  os_name: string | null;
  os_version: string | null;
  device_type: string | null;
  created_at: string;
  employee?: {
    employee_id: string;
    full_name: string;
  };
}

export default function AuditDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const { role, isAdmin, loading: roleLoading } = useUserRole();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [firstLogins, setFirstLogins] = useState<EmployeeFirstLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"audit" | "first-login">("audit");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Redirect if not admin
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, roleLoading, router]);

  useEffect(() => {
    if (isAdmin) {
      loadAuditLogs();
      loadFirstLogins();
    }
  }, [isAdmin, tableFilter, actionFilter]);

  async function loadAuditLogs() {
    try {
      setLoading(true);

      // Build query with filters
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user details for each log
      const logsWithUsers = await Promise.all(
        (data || []).map(async (log: any) => {
          if (log.user_id) {
            const { data: userData } = await supabase
              .from("users")
              .select("full_name, email")
              .eq("id", log.user_id)
              .single();

            return {
              ...log,
              user: userData || null,
            };
          }
          return log;
        })
      );

      setAuditLogs(logsWithUsers as AuditLog[]);
    } catch (error: any) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFirstLogins() {
    try {
      // Try to load from employee_first_login first
      const { data: firstLoginData, error: firstLoginError } = await supabase
        .from("employee_first_login")
        .select("*")
        .order("first_login_time", { ascending: false })
        .limit(200);

      // If no data in employee_first_login, fallback to time_clock_entries
      if (
        (!firstLoginData || firstLoginData.length === 0) &&
        !firstLoginError
      ) {
        // Load from time_clock_entries as fallback
        const { data: timeClockData, error: timeClockError } = await supabase
          .from("time_clock_entries")
          .select(
            `
            employee_id,
            clock_in_time,
            clock_out_time,
            clock_in_ip,
            clock_in_device,
            clock_out_ip,
            clock_out_device,
            employee:employees(employee_id, full_name)
          `
          )
          .order("clock_in_time", { ascending: true });

        if (timeClockError) {
          console.error(
            "Error loading from time_clock_entries:",
            timeClockError
          );
          // Continue with empty array
        } else if (timeClockData && timeClockData.length > 0) {
          // Group by employee and get first entry per employee
          const firstEntriesMap = new Map();
          timeClockData.forEach((entry: any) => {
            if (!firstEntriesMap.has(entry.employee_id)) {
              firstEntriesMap.set(entry.employee_id, {
                id: `tce_${entry.employee_id}`,
                employee_id: entry.employee_id,
                first_login_time: entry.clock_in_time,
                first_logout_time: entry.clock_out_time,
                ip_address: entry.clock_in_ip,
                device_info: entry.clock_in_device,
                user_agent: entry.clock_in_device,
                browser_name: null,
                browser_version: null,
                os_name: null,
                os_version: null,
                device_type:
                  entry.clock_in_device?.toLowerCase().includes("mobile") ||
                  entry.clock_in_device?.toLowerCase().includes("android") ||
                  entry.clock_in_device?.toLowerCase().includes("iphone")
                    ? "mobile"
                    : "desktop",
                created_at: entry.clock_in_time,
                employee: entry.employee,
              });
            }
          });

          const loginsFromTimeClock = Array.from(firstEntriesMap.values());
          setFirstLogins(loginsFromTimeClock as EmployeeFirstLogin[]);
          return;
        }
      }

      if (firstLoginError) {
        console.error("Error loading first logins:", firstLoginError);
        // Try fallback to time_clock_entries
        const { data: timeClockData } = await supabase
          .from("time_clock_entries")
          .select(
            `
            employee_id,
            clock_in_time,
            clock_out_time,
            clock_in_ip,
            clock_in_device,
            employee:employees(employee_id, full_name)
          `
          )
          .order("clock_in_time", { ascending: true })
          .limit(200);

        if (timeClockData && timeClockData.length > 0) {
          const firstEntriesMap = new Map();
          timeClockData.forEach((entry: any) => {
            if (!firstEntriesMap.has(entry.employee_id)) {
              firstEntriesMap.set(entry.employee_id, {
                id: `tce_${entry.employee_id}`,
                employee_id: entry.employee_id,
                first_login_time: entry.clock_in_time,
                first_logout_time: entry.clock_out_time,
                ip_address: entry.clock_in_ip,
                device_info: entry.clock_in_device,
                user_agent: entry.clock_in_device,
                device_type: "desktop",
                employee: entry.employee,
              });
            }
          });
          setFirstLogins(
            Array.from(firstEntriesMap.values()) as EmployeeFirstLogin[]
          );
          return;
        }
      }

      // Fetch employee details for each first login
      const loginsWithEmployees = await Promise.all(
        (firstLoginData || []).map(async (login: any) => {
          const { data: employeeData } = await supabase
            .from("employees")
            .select("employee_id, full_name")
            .eq("id", login.employee_id)
            .single();

          return {
            ...login,
            employee: employeeData || null,
          };
        })
      );

      setFirstLogins(loginsWithEmployees as EmployeeFirstLogin[]);
    } catch (error: any) {
      console.error("Error loading first logins:", error);
    }
  }

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const userMatch =
        log.user?.full_name?.toLowerCase().includes(searchLower) ||
        log.user?.email?.toLowerCase().includes(searchLower);
      const recordMatch = log.record_id?.toLowerCase().includes(searchLower);
      const tableMatch = log.table_name?.toLowerCase().includes(searchLower);
      return userMatch || recordMatch || tableMatch;
    }
    return true;
  });

  const filteredFirstLogins = firstLogins.filter((login) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const employeeMatch =
        login.employee?.employee_id?.toLowerCase().includes(searchLower) ||
        login.employee?.full_name?.toLowerCase().includes(searchLower);
      const ipMatch = login.ip_address?.toLowerCase().includes(searchLower);
      return employeeMatch || ipMatch;
    }
    return true;
  });

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

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <DashboardLayout>
      <VStack gap="6" className="w-full">
        {/* Header */}
        <VStack gap="2" align="start">
          <H1>Audit Dashboard</H1>
          <BodySmall>
            Comprehensive audit trail and employee first login tracking
          </BodySmall>
        </VStack>

        {/* Tabs */}
        <HStack gap="2">
          <Button
            variant={activeTab === "audit" ? "default" : "outline"}
            onClick={() => setActiveTab("audit")}
          >
            <Icon name="FileText" size={IconSizes.sm} className="mr-2" />
            Audit Logs
          </Button>
          <Button
            variant={activeTab === "first-login" ? "default" : "outline"}
            onClick={() => setActiveTab("first-login")}
          >
            <Icon name="SignIn" size={IconSizes.sm} className="mr-2" />
            First Login Tracking
          </Button>
        </HStack>

        {/* Filters */}
        {activeTab === "audit" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <HStack gap="4" className="flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Search by user, record ID, or table..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {activeTab === "audit" && (
                  <>
                    <div className="min-w-[150px]">
                      <Label htmlFor="table-filter">Table</Label>
                      <Select
                        value={tableFilter}
                        onValueChange={setTableFilter}
                      >
                        <SelectTrigger id="table-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tables</SelectItem>
                          <SelectItem value="employees">Employees</SelectItem>
                          <SelectItem value="employee_loans">Loans</SelectItem>
                          <SelectItem value="employee_deductions">
                            Deductions
                          </SelectItem>
                          <SelectItem value="employee_location_assignments">
                            Locations
                          </SelectItem>
                          <SelectItem value="employee_week_schedules">
                            Schedules
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[150px]">
                      <Label htmlFor="action-filter">Action</Label>
                      <Select
                        value={actionFilter}
                        onValueChange={setActionFilter}
                      >
                        <SelectTrigger id="action-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actions</SelectItem>
                          <SelectItem value="INSERT">Create</SelectItem>
                          <SelectItem value="UPDATE">Update</SelectItem>
                          <SelectItem value="DELETE">Delete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </HStack>
            </CardContent>
          </Card>
        )}

        {/* Audit Logs Tab */}
        {activeTab === "audit" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Audit Logs</CardTitle>
              <CardDescription className="text-xs">
                {filteredAuditLogs.length} log entries found
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {filteredAuditLogs.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No audit logs found
                  </div>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <HStack justify="between" className="flex-wrap gap-2">
                        <HStack gap="2">
                          <Badge
                            variant={
                              log.action === "INSERT"
                                ? "default"
                                : log.action === "UPDATE"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {log.action}
                          </Badge>
                          <Badge variant="outline">{log.table_name}</Badge>
                          <Caption>
                            {format(
                              new Date(log.created_at),
                              "MMM d, yyyy HH:mm:ss"
                            )}
                          </Caption>
                        </HStack>
                        <Caption>
                          {log.user?.full_name || log.user?.email || "System"}
                        </Caption>
                      </HStack>
                      {/* Record ID - subtle display */}
                      <div className="text-xs text-muted-foreground font-mono">
                        ID: {log.record_id?.substring(0, 8)}...
                      </div>
                      {/* Formatted Changes Display */}
                      {log.action === "UPDATE" &&
                      log.old_values &&
                      log.new_values ? (
                        <AuditChangesDisplay
                          oldValues={log.old_values}
                          newValues={log.new_values}
                          tableName={log.table_name}
                        />
                      ) : log.action === "INSERT" && log.new_values ? (
                        <AuditInsertDisplay
                          values={log.new_values}
                          tableName={log.table_name}
                        />
                      ) : log.action === "DELETE" && log.old_values ? (
                        <AuditDeleteDisplay
                          values={log.old_values}
                          tableName={log.table_name}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          No change details available
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* First Login Tab */}
        {activeTab === "first-login" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Employee First Login Tracking
              </CardTitle>
              <CardDescription className="text-xs">
                {filteredFirstLogins.length} employees tracked • Data sourced
                from employee portal login and time clock entries
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {filteredFirstLogins.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No first login records found
                  </div>
                ) : (
                  filteredFirstLogins.map((login) => (
                    <div
                      key={login.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <HStack justify="between" className="flex-wrap gap-2">
                        <VStack gap="1" align="start">
                          <div className="font-semibold">
                            {login.employee?.full_name || "Unknown Employee"}
                          </div>
                          <Caption>
                            {login.employee?.employee_id || login.employee_id}
                          </Caption>
                        </VStack>
                        <VStack gap="1" align="end">
                          <Badge variant="outline">
                            {format(
                              new Date(login.first_login_time),
                              "MMM d, yyyy HH:mm:ss"
                            )}
                          </Badge>
                          {login.first_logout_time && (
                            <Caption>
                              Logged out:{" "}
                              {format(
                                new Date(login.first_logout_time),
                                "MMM d, yyyy HH:mm:ss"
                              )}
                            </Caption>
                          )}
                        </VStack>
                      </HStack>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                        <div>
                          <strong>IP Address:</strong>{" "}
                          {login.ip_address || "Not available"}
                        </div>
                        <div>
                          <strong>Device Type:</strong>{" "}
                          {login.device_type
                            ? login.device_type.charAt(0).toUpperCase() +
                              login.device_type.slice(1)
                            : "Unknown"}
                        </div>
                        <div>
                          <strong>Browser:</strong>{" "}
                          {login.browser_name && login.browser_version
                            ? `${login.browser_name} ${login.browser_version}`
                            : "Unknown"}
                        </div>
                        <div>
                          <strong>OS:</strong>{" "}
                          {login.os_name && login.os_version
                            ? `${login.os_name} ${login.os_version}`
                            : "Unknown"}
                        </div>
                        {login.device_info && (
                          <div className="md:col-span-2">
                            <strong>Device Info:</strong> {login.device_info}
                          </div>
                        )}
                        {login.user_agent && (
                          <div className="md:col-span-2">
                            <strong>User Agent:</strong>{" "}
                            <span className="text-xs text-muted-foreground">
                              {login.user_agent}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </VStack>
    </DashboardLayout>
  );
}





