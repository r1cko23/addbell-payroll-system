/**
 * Example usage of the FilterPanel component
 *
 * This file demonstrates how to integrate FilterPanel with leave request data
 */

"use client";

import { useState, useMemo } from "react";
import { FilterPanel, type LeaveRequestFilterConfig } from "./FilterPanel";
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";
import { type LeaveRequest } from "@/utils/leave-requests";
import { Card, CardContent } from "@/components/ui/card";
import { VStack } from "@/components/ui/stack";
import { H3, BodySmall } from "@/components/ui/typography";

/**
 * Example component showing FilterPanel integration
 */
export function LeaveRequestListWithFilters() {
  // Sample leave requests data
  const [leaveRequests] = useState<LeaveRequest[]>([
    {
      id: "1",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      status: "pending",
      leaveType: "SIL",
      department: "Engineering",
    },
    {
      id: "2",
      employeeName: "Jane Smith",
      employeeId: "EMP002",
      startDate: "2024-01-20",
      endDate: "2024-01-22",
      status: "approved_by_manager",
      leaveType: "LWOP",
      department: "Sales",
      approvedByManager: true,
    },
    // ... more requests
  ]);

  // Filter state
  const [filters, setFilters] = useState<LeaveRequestFilterConfig>({
    dateRange: { preset: null, startDate: null, endDate: null },
    status: [],
    leaveType: [],
    employeeIds: [],
    departments: [],
    approvalStage: [],
  });

  // Apply filters and group results
  const { grouped, filteredCount } = useMemo(() => {
    const result = filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date",
      "date-asc"
    );
    return {
      grouped: result,
      filteredCount: result.groups.reduce((sum, g) => sum + g.count, 0),
    };
  }, [leaveRequests, filters]);

  // Handle filter changes
  const handleFilterChange = (
    newFilters: LeaveRequestFilterConfig,
    count: number
  ) => {
    setFilters(newFilters);
    console.log(`Filters changed: ${count} requests match`);
  };

  return (
    <VStack gap="6">
      {/* Filter Panel */}
      <FilterPanel
        leaveRequests={leaveRequests}
        onFilterChange={handleFilterChange}
        showPreview={true}
        storageKey="leaveRequestFilters"
      />

      {/* Filtered Results */}
      <div>
        <H3>Filtered Results ({filteredCount})</H3>
        {grouped.groups.map((group) => (
          <Card key={group.key} className="mt-4">
            <CardContent className="p-4">
              <VStack gap="2">
                <div className="font-semibold">
                  {group.label} ({group.count})
                </div>
                {group.items.map((request) => (
                  <div
                    key={request.id}
                    className="border-b pb-2 last:border-b-0"
                  >
                    <BodySmall>
                      {request.employeeName} - {request.leaveType} -{" "}
                      {request.startDate} to {request.endDate}
                    </BodySmall>
                  </div>
                ))}
              </VStack>
            </CardContent>
          </Card>
        ))}
      </div>
    </VStack>
  );
}

/**
 * Example: Using FilterPanel with Supabase data
 */
export function LeaveRequestListWithSupabase() {
  // This would typically come from a Supabase query
  // const { data: leaveRequests } = await supabase
  //   .from('leave_requests')
  //   .select(`
  //     *,
  //     employees (full_name, department)
  //   `);

  // Transform database results to FilterPanel format
  // const transformedRequests = data.map((dbRequest) => ({
  //   id: dbRequest.id,
  //   employeeName: dbRequest.employees.full_name,
  //   employeeId: dbRequest.employee_id,
  //   startDate: dbRequest.start_date,
  //   endDate: dbRequest.end_date,
  //   status: dbRequest.status,
  //   leaveType: dbRequest.leave_type,
  //   department: dbRequest.employees.department,
  //   approvedByManager: !!dbRequest.account_manager_id,
  //   approvedByHR: !!dbRequest.hr_approver_id,
  // }));

  return (
    <FilterPanel
      leaveRequests={[]}
      filterOptions={{
        statuses: [
          "pending",
          "approved_by_manager",
          "approved_by_hr",
          "rejected",
        ],
        leaveTypes: ["SIL", "LWOP", "Maternity Leave", "Paternity Leave"],
        departments: ["Engineering", "Sales", "HR"],
      }}
      onFilterChange={(filters, count) => {
        console.log("Filters:", filters);
        console.log("Matching count:", count);
      }}
    />
  );
}

/**
 * Example: Custom filter options
 */
export function LeaveRequestListWithCustomOptions() {
  const leaveRequests: LeaveRequest[] = [];

  return (
    <FilterPanel
      leaveRequests={leaveRequests}
      filterOptions={{
        // Pre-define available options
        statuses: ["pending", "approved_by_manager", "approved_by_hr"],
        leaveTypes: ["SIL", "LWOP"],
        employees: [
          { id: "EMP001", name: "John Doe" },
          { id: "EMP002", name: "Jane Smith" },
        ],
        departments: ["Engineering", "Sales"],
      }}
      storageKey="customLeaveFilters"
      showPreview={true}
    />
  );
}











