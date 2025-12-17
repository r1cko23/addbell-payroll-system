/**
 * Example usage of the GroupedLeaveList component
 *
 * This file demonstrates how to use GroupedLeaveList with grouped leave request data
 */

"use client";

import { useState, useMemo } from "react";
import { GroupedLeaveList } from "./GroupedLeaveList";
import { groupLeaveRequests } from "@/utils/leave-requests";
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";
import type { LeaveRequestCardData } from "./LeaveRequestCard";
import type { LeaveRequestFilterConfig } from "./FilterPanel";

/**
 * Example: Basic usage with grouped data
 */
export function BasicGroupedLeaveListExample() {
  const leaveRequests: LeaveRequestCardData[] = [
    {
      id: "1",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      status: "pending",
      leaveType: "SIL",
      totalDays: 3,
      department: "Engineering",
    },
    {
      id: "2",
      employeeName: "Jane Smith",
      employeeId: "EMP002",
      startDate: "2024-01-20",
      endDate: "2024-01-22",
      status: "pending",
      leaveType: "LWOP",
      totalDays: 3,
      department: "Sales",
    },
  ];

  // Group by date
  const grouped = groupLeaveRequests(leaveRequests, "date", "date-asc");

  return (
    <GroupedLeaveList
      groupedData={grouped}
      userRole="account_manager"
      onApprove={(id, level) => console.log("Approve:", id, level)}
      onReject={(id) => console.log("Reject:", id)}
      onViewDetails={(id) => console.log("View:", id)}
    />
  );
}

/**
 * Example: With filters applied
 */
export function FilteredGroupedLeaveListExample() {
  const leaveRequests: LeaveRequestCardData[] = [
    // ... your leave requests
  ];

  const filters: LeaveRequestFilterConfig = {
    dateRange: { preset: "thisWeek" },
    status: ["pending"],
    leaveType: [],
    employeeIds: [],
    departments: [],
    approvalStage: [],
  };

  // Filter and group
  const grouped = filterAndGroupLeaveRequests(
    leaveRequests,
    filters,
    "status",
    "date-asc"
  );

  return (
    <GroupedLeaveList
      groupedData={grouped}
      userRole="hr"
      showActions={true}
      defaultExpanded={false}
      virtualScrollThreshold={15}
    />
  );
}

/**
 * Example: Grouped by status
 */
export function StatusGroupedLeaveListExample() {
  const leaveRequests: LeaveRequestCardData[] = [
    {
      id: "1",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      status: "pending",
      leaveType: "SIL",
      totalDays: 3,
    },
    {
      id: "2",
      employeeName: "Jane Smith",
      employeeId: "EMP002",
      startDate: "2024-01-20",
      endDate: "2024-01-22",
      status: "approved_by_manager",
      leaveType: "LWOP",
      totalDays: 3,
    },
    {
      id: "3",
      employeeName: "Bob Johnson",
      employeeId: "EMP003",
      startDate: "2024-01-25",
      endDate: "2024-01-27",
      status: "approved_by_hr",
      leaveType: "SIL",
      totalDays: 3,
    },
  ];

  const grouped = groupLeaveRequests(leaveRequests, "status", "name");

  return (
    <GroupedLeaveList
      groupedData={grouped}
      userRole="account_manager"
      defaultExpanded={true}
    />
  );
}

/**
 * Example: Large list with virtual scrolling
 */
export function LargeGroupedLeaveListExample() {
  // Generate many requests for virtual scrolling demo
  const leaveRequests: LeaveRequestCardData[] = Array.from(
    { length: 50 },
    (_, i) => ({
      id: `req-${i}`,
      employeeName: `Employee ${i + 1}`,
      employeeId: `EMP${String(i + 1).padStart(3, "0")}`,
      startDate: `2024-01-${String(15 + i).padStart(2, "0")}`,
      endDate: `2024-01-${String(17 + i).padStart(2, "0")}`,
      status:
        i % 3 === 0
          ? "pending"
          : i % 3 === 1
          ? "approved_by_manager"
          : "approved_by_hr",
      leaveType: i % 2 === 0 ? "SIL" : "LWOP",
      totalDays: 3,
      department: i % 2 === 0 ? "Engineering" : "Sales",
    })
  );

  const grouped = groupLeaveRequests(leaveRequests, "date", "date-asc");

  return (
    <GroupedLeaveList
      groupedData={grouped}
      userRole="hr"
      virtualScrollThreshold={20}
      defaultExpanded={true}
    />
  );
}

/**
 * Example: Complete integration with FilterPanel
 */
export function CompleteIntegrationExample() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestCardData[]>(
    []
  );
  const [filters, setFilters] = useState<LeaveRequestFilterConfig>({
    dateRange: { preset: null, startDate: null, endDate: null },
    status: [],
    leaveType: [],
    employeeIds: [],
    departments: [],
    approvalStage: [],
  });

  // Filter and group
  const grouped = useMemo(() => {
    return filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date",
      "date-asc"
    );
  }, [leaveRequests, filters]);

  const handleFilterChange = (
    newFilters: LeaveRequestFilterConfig,
    count: number
  ) => {
    setFilters(newFilters);
  };

  return (
    <div>
      {/* FilterPanel would go here */}
      <GroupedLeaveList
        groupedData={grouped}
        userRole="account_manager"
        onApprove={(id, level) => {
          // Handle approval
        }}
        onReject={(id) => {
          // Handle rejection
        }}
        onViewDetails={(id) => {
          // Open details modal
        }}
      />
    </div>
  );
}











