/**
 * Utility functions for filtering leave requests
 * Integrates with the leave request grouping utility
 */

import {
  type LeaveRequest,
  groupLeaveRequests,
  type GroupByDimension,
  type SortOption,
} from "./leave-requests";
import type { LeaveRequestFilterConfig } from "@/components/FilterPanel";

/**
 * Apply filters and then group the results
 * @param leaveRequests - Array of leave requests
 * @param filters - Filter configuration
 * @param groupBy - Grouping dimension
 * @param sortBy - Sort option
 * @returns Grouped and filtered leave requests
 */
export function filterAndGroupLeaveRequests(
  leaveRequests: LeaveRequest[],
  filters: LeaveRequestFilterConfig,
  groupBy: GroupByDimension = "date",
  sortBy: SortOption = "date-asc"
) {
  // First apply filters
  const filtered = applyFiltersToLeaveRequests(leaveRequests, filters);

  // Then group the filtered results
  return groupLeaveRequests(filtered, groupBy, sortBy);
}

/**
 * Apply filters to leave requests (matching FilterPanel's applyFilters logic)
 * @param leaveRequests - Array of leave requests
 * @param filters - Filter configuration
 * @returns Filtered leave requests
 */
export function applyFiltersToLeaveRequests(
  leaveRequests: LeaveRequest[],
  filters: LeaveRequestFilterConfig
): LeaveRequest[] {
  let filtered = [...leaveRequests];

  // Date range filter
  if (filters.dateRange.startDate || filters.dateRange.endDate) {
    filtered = filtered.filter((req) => {
      const startDate = filters.dateRange.startDate;
      const endDate = filters.dateRange.endDate;
      const reqStart = new Date(req.startDate);
      const reqEnd = new Date(req.endDate);

      if (startDate && reqEnd < new Date(startDate)) return false;
      if (endDate && reqStart > new Date(endDate)) return false;
      return true;
    });
  }

  // Status filter
  if (filters.status.length > 0) {
    filtered = filtered.filter((req) => filters.status.includes(req.status));
  }

  // Leave type filter
  if (filters.leaveType.length > 0) {
    filtered = filtered.filter((req) =>
      filters.leaveType.includes(req.leaveType)
    );
  }

  // Employee filter
  if (filters.employeeIds.length > 0) {
    filtered = filtered.filter((req) =>
      filters.employeeIds.includes(req.employeeId)
    );
  }

  // Department filter
  if (filters.departments.length > 0) {
    filtered = filtered.filter((req) => {
      if (!req.department) return false;
      return filters.departments.includes(req.department);
    });
  }

  // Approval stage filter
  if (filters.approvalStage.length > 0) {
    filtered = filtered.filter((req) => {
      if (filters.approvalStage.includes("pending")) {
        if (req.status === "pending") return true;
      }
      if (filters.approvalStage.includes("manager_approved")) {
        if (req.approvedByManager && !req.approvedByHR) return true;
      }
      if (filters.approvalStage.includes("hr_approved")) {
        if (req.approvedByHR) return true;
      }
      if (filters.approvalStage.includes("rejected")) {
        if (req.status === "rejected") return true;
      }
      return false;
    });
  }

  return filtered;
}

/**
 * Check if any filters are active
 * @param filters - Filter configuration
 * @returns True if any filters are applied
 */
export function hasActiveFilters(filters: LeaveRequestFilterConfig): boolean {
  return (
    filters.dateRange.startDate !== null ||
    filters.dateRange.endDate !== null ||
    filters.status.length > 0 ||
    filters.leaveType.length > 0 ||
    filters.employeeIds.length > 0 ||
    filters.departments.length > 0 ||
    filters.approvalStage.length > 0
  );
}

/**
 * Get count of active filters
 * @param filters - Filter configuration
 * @returns Number of active filters
 */
export function getActiveFilterCount(
  filters: LeaveRequestFilterConfig
): number {
  let count = 0;

  if (filters.dateRange.startDate || filters.dateRange.endDate) count++;
  if (filters.status.length > 0) count++;
  if (filters.leaveType.length > 0) count++;
  if (filters.employeeIds.length > 0) count++;
  if (filters.departments.length > 0) count++;
  if (filters.approvalStage.length > 0) count++;

  return count;
}










