/**
 * Utility functions for grouping and sorting leave requests
 */

import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isBefore,
  isAfter,
  isToday,
  isSameDay,
  parseISO,
  differenceInDays,
} from "date-fns";

/**
 * Leave request interface matching the expected structure
 */
export interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  status:
    | "pending"
    | "approved_by_manager"
    | "approved_by_hr"
    | "rejected"
    | "cancelled";
  leaveType: string;
  approvedByManager?: boolean;
  approvedByHR?: boolean;
  department?: string; // Optional department field
}

/**
 * Date bucket categories for intelligent date grouping
 */
export type DateBucket =
  | "Today"
  | "This Week"
  | "This Month"
  | "Overdue"
  | "Upcoming";

/**
 * Grouping dimension options
 */
export type GroupByDimension = "date" | "status" | "employee" | "department";

/**
 * Sorting options
 */
export type SortOption = "date-asc" | "date-desc" | "name" | "status";

/**
 * Grouped leave request structure
 */
export interface GroupedLeaveRequests {
  [key: string]: {
    label: string;
    items: LeaveRequest[];
    count: number;
  };
}

/**
 * Nested grouped structure for rendering
 */
export interface NestedGroupedLeaveRequests {
  groups: Array<{
    key: string;
    label: string;
    count: number;
    items: LeaveRequest[];
  }>;
}

/**
 * Determines which date bucket a leave request falls into based on its start date
 * @param startDate - ISO date string
 * @returns DateBucket category
 */
export function getDateBucket(startDate: string): DateBucket {
  const date = parseISO(startDate);
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Check if date is today
  if (isToday(date)) {
    return "Today";
  }

  // Check if date is in the current week (Monday to Sunday)
  if (!isBefore(date, weekStart) && !isAfter(date, weekEnd)) {
    return "This Week";
  }

  // Check if date is in the current month
  if (!isBefore(date, monthStart) && !isAfter(date, monthEnd)) {
    return "This Month";
  }

  // Check if date is overdue (in the past and not today)
  if (isBefore(date, today) && !isToday(date)) {
    return "Overdue";
  }

  // Future dates beyond current month
  return "Upcoming";
}

/**
 * Gets a human-readable label for a date bucket
 * @param bucket - DateBucket category
 * @returns Formatted label string
 */
export function getDateBucketLabel(bucket: DateBucket): string {
  const labels: Record<DateBucket, string> = {
    Today: "Today",
    "This Week": "This Week",
    "This Month": "This Month",
    Overdue: "Overdue",
    Upcoming: "Upcoming",
  };
  return labels[bucket];
}

/**
 * Gets the sort order for date buckets (for consistent ordering)
 * @param bucket - DateBucket category
 * @returns Numeric sort order
 */
export function getDateBucketSortOrder(bucket: DateBucket): number {
  const order: Record<DateBucket, number> = {
    Overdue: 0,
    Today: 1,
    "This Week": 2,
    "This Month": 3,
    Upcoming: 4,
  };
  return order[bucket];
}

/**
 * Sorts leave requests based on the specified sort option
 * @param items - Array of leave requests
 * @param sortBy - Sort option
 * @returns Sorted array
 */
export function sortLeaveRequests(
  items: LeaveRequest[],
  sortBy: SortOption
): LeaveRequest[] {
  const sorted = [...items];

  switch (sortBy) {
    case "date-asc":
      return sorted.sort((a, b) => {
        const dateA = parseISO(a.startDate);
        const dateB = parseISO(b.startDate);
        return dateA.getTime() - dateB.getTime();
      });

    case "date-desc":
      return sorted.sort((a, b) => {
        const dateA = parseISO(a.startDate);
        const dateB = parseISO(b.startDate);
        return dateB.getTime() - dateA.getTime();
      });

    case "name":
      return sorted.sort((a, b) => {
        const nameA = a.employeeName.toLowerCase();
        const nameB = b.employeeName.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

    case "status":
      const statusOrder: Record<string, number> = {
        pending: 0,
        approved_by_manager: 1,
        approved_by_hr: 2,
        rejected: 3,
        cancelled: 4,
      };
      return sorted.sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 999;
        const orderB = statusOrder[b.status] ?? 999;
        return orderA - orderB;
      });

    default:
      return sorted;
  }
}

/**
 * Gets the grouping key for a leave request based on the dimension
 * @param request - Leave request
 * @param groupBy - Grouping dimension
 * @returns Grouping key string
 */
function getGroupKey(request: LeaveRequest, groupBy: GroupByDimension): string {
  switch (groupBy) {
    case "date":
      return getDateBucket(request.startDate);

    case "status":
      return request.status;

    case "employee":
      return request.employeeId;

    case "department":
      return request.department || "Unassigned";

    default:
      return "Unknown";
  }
}

/**
 * Gets a human-readable label for a group key
 * @param key - Group key
 * @param groupBy - Grouping dimension
 * @returns Formatted label string
 */
function getGroupLabel(key: string, groupBy: GroupByDimension): string {
  switch (groupBy) {
    case "date":
      return getDateBucketLabel(key as DateBucket);

    case "status":
      // Format status labels nicely
      return key
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    case "employee":
      // For employee grouping, we'll need to look up the name
      // This will be handled by the caller if needed
      return key;

    case "department":
      return key;

    default:
      return key;
  }
}

/**
 * Gets the sort order for group keys (for consistent ordering)
 * @param key - Group key
 * @param groupBy - Grouping dimension
 * @returns Numeric sort order
 */
function getGroupSortOrder(key: string, groupBy: GroupByDimension): number {
  switch (groupBy) {
    case "date":
      return getDateBucketSortOrder(key as DateBucket);

    case "status":
      const statusOrder: Record<string, number> = {
        pending: 0,
        approved_by_manager: 1,
        approved_by_hr: 2,
        rejected: 3,
        cancelled: 4,
      };
      return statusOrder[key] ?? 999;

    case "employee":
    case "department":
      // Alphabetical sorting
      return 0; // Will be sorted by key name

    default:
      return 0;
  }
}

/**
 * Groups and sorts leave requests by the specified dimension
 * @param leaveRequests - Array of leave requests
 * @param groupBy - Dimension to group by ('date' | 'status' | 'employee' | 'department')
 * @param sortBy - Sort option ('date-asc' | 'date-desc' | 'name' | 'status')
 * @returns Nested grouped structure ready for rendering
 */
export function groupLeaveRequests(
  leaveRequests: LeaveRequest[],
  groupBy: GroupByDimension = "date",
  sortBy: SortOption = "date-asc"
): NestedGroupedLeaveRequests {
  // First, sort all items within each group
  const sortedRequests = sortLeaveRequests(leaveRequests, sortBy);

  // Group by the specified dimension
  const grouped: GroupedLeaveRequests = {};

  sortedRequests.forEach((request) => {
    const key = getGroupKey(request, groupBy);

    if (!grouped[key]) {
      grouped[key] = {
        label: getGroupLabel(key, groupBy),
        items: [],
        count: 0,
      };
    }

    grouped[key].items.push(request);
    grouped[key].count++;
  });

  // Convert to array and sort groups
  const groups = Object.entries(grouped)
    .map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count,
      items: value.items,
    }))
    .sort((a, b) => {
      // First sort by group order
      const orderA = getGroupSortOrder(a.key, groupBy);
      const orderB = getGroupSortOrder(b.key, groupBy);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // If same order, sort alphabetically by label
      return a.label.localeCompare(b.label);
    });

  return { groups };
}

/**
 * Helper function to transform database leave request structure to the utility format
 * Useful when working with Supabase queries that return snake_case properties
 * @param dbRequest - Database leave request (snake_case)
 * @param employeeName - Employee name (from join or lookup)
 * @param department - Optional department name
 * @returns Transformed LeaveRequest
 */
export function transformDbLeaveRequest(
  dbRequest: {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    status: string;
    leave_type: string;
    account_manager_id?: string | null;
    hr_approver_id?: string | null;
  },
  employeeName: string,
  department?: string
): LeaveRequest {
  return {
    id: dbRequest.id,
    employeeName,
    employeeId: dbRequest.employee_id,
    startDate: dbRequest.start_date,
    endDate: dbRequest.end_date,
    status: dbRequest.status as LeaveRequest["status"],
    leaveType: dbRequest.leave_type,
    approvedByManager: !!dbRequest.account_manager_id,
    approvedByHR: !!dbRequest.hr_approver_id,
    department,
  };
}

/**
 * Gets a formatted date range string for display
 * @param startDate - ISO date string
 * @param endDate - ISO date string
 * @param selectedDates - Optional array of selected dates (for non-consecutive dates)
 * @returns Formatted date range string
 */
export function formatDateRange(
  startDate: string,
  endDate: string,
  selectedDates?: string[] | null
): string {
  // If selected dates are provided, format them
  if (selectedDates && selectedDates.length > 0) {
    if (selectedDates.length === 1) {
      return format(parseISO(selectedDates[0]), "MMM dd, yyyy");
    }
    // Show first few dates with ellipsis if many
    const displayDates = selectedDates.slice(0, 3);
    const formatted = displayDates
      .map((d) => format(parseISO(d), "MMM dd"))
      .join(", ");
    return selectedDates.length > 3
      ? `${formatted}... (${selectedDates.length} dates)`
      : formatted;
  }

  // Fallback to date range
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (isSameDay(start, end)) {
    return format(start, "MMM dd, yyyy");
  }

  return `${format(start, "MMM dd")} - ${format(end, "MMM dd, yyyy")}`;
}

/**
 * Checks if a leave request is overdue
 * @param startDate - ISO date string
 * @returns True if the request start date is in the past
 */
export function isLeaveRequestOverdue(startDate: string): boolean {
  const date = parseISO(startDate);
  return isBefore(date, new Date()) && !isToday(date);
}

/**
 * Gets the number of days until a leave request starts
 * @param startDate - ISO date string
 * @returns Number of days (negative if in the past)
 */
export function getDaysUntilLeave(startDate: string): number {
  const date = parseISO(startDate);
  const today = new Date();
  return differenceInDays(date, today);
}

