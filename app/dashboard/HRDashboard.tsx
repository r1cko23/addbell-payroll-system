"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { format } from "date-fns";
import { OfficeLocation, resolveLocationDetails } from "@/lib/location";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/format";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";

interface ClockEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: string;
  clock_in_location: string | null;
  clock_out_location: string | null;
  employees: {
    employee_id: string;
    full_name: string;
    profile_picture_url?: string | null;
  };
}

export default function HRDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [recentEntries, setRecentEntries] = useState<ClockEntry[]>([]);
  const [clockedInEntries, setClockedInEntries] = useState<ClockEntry[]>([]);
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [pendingLeaveManager, setPendingLeaveManager] = useState(0);
  const [pendingLeaveHR, setPendingLeaveHR] = useState(0);
  const [parentalLeaves, setParentalLeaves] = useState<
    {
      leave_id: string;
      employee_id: string;
      employee_name: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      total_days: number;
    }[]
  >([]);
  const [employeesOnDayOff, setEmployeesOnDayOff] = useState<
    {
      employee_id: string;
      employee_name: string;
      employee_id_text: string;
      schedule_date: string;
      profile_picture_url: string | null;
    }[]
  >([]);
  const [payslipStats, setPayslipStats] = useState({
    totalPayslips: 0,
    pendingApprovals: 0,
    paid: 0,
    recentPayslips: [] as any[],
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [
          employeeCountRes,
          recentRes,
          activeRes,
          locationsRes,
          leavePendingRes,
          leaveHRRes,
          parentalRes,
          dayOffRes,
          payslipTotalRes,
          payslipPendingRes,
          payslipPaidRes,
          payslipRecentRes,
        ] = await Promise.all([
          supabase
            .from("employees")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("time_clock_entries")
            .select(
              `
              *,
              employees (
                employee_id,
                full_name,
                profile_picture_url
              )
            `
            )
            .order("clock_in_time", { ascending: false })
            .limit(8),
          supabase
            .from("time_clock_entries")
            .select(
              `
              *,
              employees (
                employee_id,
                full_name,
                profile_picture_url
              )
            `
            )
            .eq("status", "clocked_in")
            .is("clock_out_time", null)
            // Only show clock-ins from today forward to avoid stale INC entries
            .gte("clock_in_time", startOfToday.toISOString())
            .order("clock_in_time", { ascending: true }),
          supabase
            .from("office_locations")
            .select("id, name, address, latitude, longitude, radius_meters"),
          supabase
            .from("leave_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .is("rejected_at", null),
          supabase
            .from("leave_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved_by_manager"),
          supabase.rpc("get_active_parental_leaves"),
          supabase.rpc("get_employees_on_day_off_today"),
          // Payslip statistics
          supabase.from("payslips").select("*", { count: "exact", head: true }),
          supabase
            .from("payslips")
            .select("*", { count: "exact", head: true })
            .eq("status", "draft"),
          supabase
            .from("payslips")
            .select("*", { count: "exact", head: true })
            .eq("status", "paid"),
          supabase
            .from("payslips")
            .select(
              `
              id,
              status,
              created_at,
              net_pay,
              employee_id,
              employees(full_name, employee_id)
            `
            )
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        // Check for errors in responses
        if (employeeCountRes.error) {
          console.error(
            "Error fetching employee count:",
            employeeCountRes.error
          );
        }
        if (recentRes.error) {
          console.error("Error fetching recent entries:", recentRes.error);
        }
        if (activeRes.error) {
          console.error("Error fetching clocked in entries:", activeRes.error);
        }
        if (locationsRes.error) {
          console.error("Error fetching office locations:", locationsRes.error);
        }

        setTotalEmployees(employeeCountRes.count || 0);
        setRecentEntries((recentRes.data || []) as ClockEntry[]);
        setClockedInEntries((activeRes.data || []) as ClockEntry[]);
        setOfficeLocations((locationsRes.data || []) as OfficeLocation[]);
        setPendingLeaveManager(leavePendingRes.count || 0);
        setPendingLeaveHR(leaveHRRes.count || 0);
        setParentalLeaves(
          (parentalRes.data || []) as {
            leave_id: string;
            employee_id: string;
            employee_name: string;
            leave_type: string;
            start_date: string;
            end_date: string;
            total_days: number;
          }[]
        );
        setEmployeesOnDayOff(
          (dayOffRes.data || []) as {
            employee_id: string;
            employee_name: string;
            employee_id_text: string;
            schedule_date: string;
            profile_picture_url: string | null;
          }[]
        );
        setPayslipStats({
          totalPayslips: payslipTotalRes.count || 0,
          pendingApprovals: payslipPendingRes.count || 0,
          paid: payslipPaidRes.count || 0,
          recentPayslips: payslipRecentRes.data || [],
        });
      } catch (error: any) {
        console.error("Failed to load dashboard data:", error);
        console.error("Error details:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon
          name="ArrowsClockwise"
          size={IconSizes.lg}
          className="animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  return (
      <VStack gap="8" className="w-full">
        <VStack gap="2" align="start">
          <H1>Workforce Overview</H1>
          <BodySmall>
            Track employee registrations and the latest time in/out activity.
          </BodySmall>
        </VStack>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 items-stretch">
          <Card className="h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <HStack justify="between" align="start" className="flex-1">
                <VStack gap="2" align="start" className="flex-1">
                  <BodySmall>Employees Registered</BodySmall>
                  <p className="text-3xl font-bold text-foreground leading-tight">
                    {totalEmployees}
                  </p>
                </VStack>
                <div className="p-3 bg-emerald-50 rounded-full flex-shrink-0">
                  <Icon
                    name="UsersThree"
                    size={IconSizes.md}
                    className="text-emerald-600"
                  />
                </div>
              </HStack>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <HStack justify="between" align="start" className="flex-1">
                <VStack gap="2" align="start" className="flex-1">
                  <BodySmall>Currently Clocked In</BodySmall>
                  <p className="text-3xl font-bold text-foreground leading-tight">
                    {clockedInEntries.length}
                  </p>
                </VStack>
                <div className="p-3 bg-emerald-50 rounded-full flex-shrink-0">
                  <Icon
                    name="Clock"
                    size={IconSizes.md}
                    className="text-emerald-600"
                  />
                </div>
              </HStack>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <HStack justify="between" align="start" className="flex-1">
                <VStack gap="2" align="start" className="flex-1">
                  <BodySmall>Leave — Manager Review</BodySmall>
                  <p className="text-3xl font-bold text-foreground leading-tight">
                    {pendingLeaveManager}
                  </p>
                </VStack>
                <div className="p-3 bg-blue-50 rounded-full flex-shrink-0">
                  <Icon
                    name="UsersThree"
                    size={IconSizes.md}
                    className="text-blue-600"
                  />
                </div>
              </HStack>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <HStack justify="between" align="start" className="flex-1">
                <VStack gap="2" align="start" className="flex-1">
                  <BodySmall>Leave — HR/Final</BodySmall>
                  <p className="text-3xl font-bold text-foreground leading-tight">
                    {pendingLeaveHR}
                  </p>
                </VStack>
                <div className="p-3 bg-emerald-50 rounded-full flex-shrink-0">
                  <Icon
                    name="Check"
                    size={IconSizes.md}
                    className="text-emerald-600"
                  />
                </div>
              </HStack>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <VStack gap="3" align="start" className="flex-1">
                <VStack gap="1" align="start" className="w-full">
                  <p className="text-base font-semibold text-foreground leading-tight">
                    On Day Off Today
                  </p>
                  <BodySmall className="text-muted-foreground">
                    Employees scheduled for day off today.
                  </BodySmall>
                </VStack>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(), "MMM d, yyyy")}
                </div>
                <div className="flex-1 flex items-start w-full">
                  {employeesOnDayOff.length === 0 ? (
                    <BodySmall className="text-muted-foreground">
                      No employees scheduled for day off today.
                    </BodySmall>
                  ) : (
                    <VStack gap="2" align="start" className="w-full">
                      <div className="space-y-2 w-full">
                        {employeesOnDayOff.map((emp) => (
                          <HStack
                            key={emp.employee_id}
                            gap="2"
                            align="center"
                            className="w-full"
                          >
                            <EmployeeAvatar
                              profilePictureUrl={emp.profile_picture_url}
                              fullName={emp.employee_name}
                              size="sm"
                            />
                            <BodySmall className="text-foreground flex-1">
                              {emp.employee_name}
                            </BodySmall>
                          </HStack>
                        ))}
                      </div>
                    </VStack>
                  )}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <VStack gap="3" align="start" className="flex-1">
                <VStack gap="1" align="start" className="w-full">
                  <p className="text-base font-semibold text-foreground leading-tight">
                    Parental Leave (Approved & Active)
                  </p>
                  <BodySmall className="text-muted-foreground">
                    Maternity/Paternity leaves approved by HR and active today.
                  </BodySmall>
                </VStack>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(), "MMM d, yyyy")}
                </div>
                <div className="flex-1 flex items-start">
                  {parentalLeaves.length === 0 ? (
                    <BodySmall className="text-muted-foreground">
                      No active maternity or paternity leaves today.
                    </BodySmall>
                  ) : (
                    <VStack gap="2" align="start" className="w-full">
                      <p className="text-2xl font-bold text-foreground leading-tight">
                        {parentalLeaves.length}
                      </p>
                      <BodySmall className="text-muted-foreground">
                        Active leave{parentalLeaves.length !== 1 ? "s" : ""}
                      </BodySmall>
                    </VStack>
                  )}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full md:col-span-3 lg:col-span-1">
            <CardContent className="p-6 h-full flex flex-col">
              <VStack gap="3" align="start" className="flex-1 justify-between">
                <VStack gap="2" align="start" className="flex-1">
                  <BodySmall>Manage Time Entries</BodySmall>
                  <p className="text-sm text-muted-foreground">
                    Review approvals and locations
                  </p>
                </VStack>
                <Link href="/time-entries" className="w-full">
                  <Button variant="secondary" className="w-full">
                    Open
                  </Button>
                </Link>
              </VStack>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 items-stretch">
          <CardSection
            title="Currently Clocked In"
            description="Showing employees whose status is still clocked in today."
            className="h-full"
          >
            {clockedInEntries.length === 0 ? (
              <BodySmall>No employees are clocked in at the moment.</BodySmall>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {clockedInEntries.map((entry) => {
                  const details = resolveLocationDetails(
                    entry.clock_in_location,
                    officeLocations
                  );
                  return (
                    <Card
                      key={entry.id}
                      className="h-full min-h-[220px] shadow-sm border-border"
                    >
                      <CardContent className="p-4 flex flex-col gap-3 h-full">
                        <HStack justify="between" align="start">
                          <VStack gap="1" align="start">
                            <HStack gap="2" align="center">
                              <EmployeeAvatar
                                profilePictureUrl={
                                  entry.employees.profile_picture_url
                                }
                                fullName={entry.employees.full_name}
                                size="sm"
                              />
                              <p className="text-sm font-semibold text-foreground leading-tight">
                                {entry.employees.full_name}
                              </p>
                            </HStack>
                            <Caption className="text-muted-foreground">
                              Since{" "}
                              {format(
                                new Date(entry.clock_in_time),
                                "MMM d, h:mm a"
                              )}
                            </Caption>
                          </VStack>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                            ACTIVE
                          </span>
                        </HStack>

                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Icon
                            name="MapPin"
                            size={IconSizes.xs}
                            className="mt-0.5 text-emerald-600"
                          />
                          <div className="flex-1 space-y-1">
                            {details.coordinates ? (
                              <a
                                href={`https://www.google.com/maps?q=${details.coordinates}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground font-medium text-sm leading-tight line-clamp-1 hover:text-emerald-600 hover:underline cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {details.name}
                              </a>
                            ) : (
                              <div className="text-foreground font-medium text-sm leading-tight line-clamp-1">
                                {details.name}
                              </div>
                            )}
                            <div
                              className="text-muted-foreground line-clamp-2"
                              title={details.address}
                            >
                              {details.address}
                            </div>
                            {details.coordinates && (
                              <a
                                href={`https://www.google.com/maps?q=${details.coordinates}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 mt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Icon name="MapPin" size={IconSizes.xs} />
                                View map
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardSection>

          <CardSection
            title="Recent Clock Activity"
            description="Latest clock in/out events from all employees."
            headerClassName="flex items-center justify-between"
            className="h-full"
          >
            <div className="text-xs text-muted-foreground mb-4">
              {format(new Date(), "MMM d, yyyy")}
            </div>
            {recentEntries.length === 0 ? (
              <BodySmall>No clock entries recorded yet.</BodySmall>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recentEntries.map((entry) => {
                  const clockInDetails = resolveLocationDetails(
                    entry.clock_in_location,
                    officeLocations
                  );
                  const clockOutDetails = resolveLocationDetails(
                    entry.clock_out_location,
                    officeLocations
                  );
                  const statusLabel = entry.status
                    .replace("_", " ")
                    .toUpperCase();

                  return (
                    <Card
                      key={entry.id}
                      className="h-full min-h-[240px] shadow-sm border-border"
                    >
                      <CardContent className="p-4 flex flex-col gap-3 h-full">
                        <HStack justify="between" align="start">
                          <VStack gap="1" align="start">
                            <HStack gap="2" align="center">
                              <EmployeeAvatar
                                profilePictureUrl={
                                  entry.employees.profile_picture_url
                                }
                                fullName={entry.employees.full_name}
                                size="sm"
                              />
                              <p className="text-sm font-semibold text-foreground leading-tight">
                                {entry.employees.full_name}
                              </p>
                            </HStack>
                            <Caption className="text-muted-foreground">
                              {entry.clock_out_time
                                ? statusLabel
                                : "INCOMPLETE"}{" "}
                              ·{" "}
                              {format(
                                new Date(entry.clock_in_time),
                                "MMM d, h:mm a"
                              )}
                            </Caption>
                          </VStack>
                          <Caption className="px-2 py-1 rounded-full bg-muted text-foreground">
                            {entry.employees.employee_id}
                          </Caption>
                        </HStack>

                        <VStack
                          gap="3"
                          align="start"
                          className="text-xs text-muted-foreground"
                        >
                          <div className="space-y-1">
                            <span className="font-semibold text-foreground">
                              Clock In
                            </span>
                            <div className="text-sm text-foreground leading-tight line-clamp-1">
                              {clockInDetails.name}
                            </div>
                            <div
                              className="line-clamp-2"
                              title={clockInDetails.address}
                            >
                              {clockInDetails.address}
                            </div>
                          </div>

                          {entry.clock_out_time ? (
                            <div className="space-y-1">
                              <span className="font-semibold text-foreground">
                                Clock Out
                              </span>
                              <div className="text-sm text-foreground leading-tight">
                                {format(
                                  new Date(entry.clock_out_time),
                                  "MMM d, h:mm a"
                                )}
                              </div>
                              <div className="text-sm text-foreground leading-tight line-clamp-1">
                                {clockOutDetails.name}
                              </div>
                              <div
                                className="line-clamp-2"
                                title={clockOutDetails.address}
                              >
                                {clockOutDetails.address}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="font-semibold text-orange-600">
                                Clock Out
                              </span>
                              <div className="text-sm text-orange-600 leading-tight">
                                Incomplete Entry
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Employee forgot to clock out
                              </div>
                            </div>
                          )}
                        </VStack>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardSection>
        </div>

        {/* Recent Payslips */}
        {payslipStats.recentPayslips.length > 0 && (
          <CardSection title="Recent Payslips">
            <div className="space-y-3">
              {payslipStats.recentPayslips.map((payslip: any) => (
                <Link
                  key={payslip.id}
                  href={`/payslips?employee=${payslip.employee_id}`}
                  className="block"
                >
                  <Card className="hover:bg-accent transition-colors">
                    <CardContent className="p-4">
                      <HStack justify="between" align="center">
                        <VStack gap="1" align="start">
                          <BodySmall className="font-semibold">
                            {(payslip.employees as any)?.full_name ||
                              "Unknown Employee"}
                          </BodySmall>
                          <Caption>
                            {format(
                              new Date(payslip.created_at),
                              "MMM d, yyyy"
                            )}{" "}
                            · {(payslip.employees as any)?.employee_id || ""}
                          </Caption>
                        </VStack>
                        <VStack gap="1" align="end">
                          <Badge
                            variant={
                              payslip.status === "paid" ? "default" : "outline"
                            }
                          >
                            {payslip.status.toUpperCase()}
                          </Badge>
                          <BodySmall className="font-semibold">
                            {formatCurrency(payslip.net_pay || 0)}
                          </BodySmall>
                        </VStack>
                      </HStack>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardSection>
        )}
      </VStack>
  );
}
