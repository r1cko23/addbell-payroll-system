/**
 * Leave Module - Public API
 *
 * This module handles all leave-related functionality:
 * - Leave requests
 * - Leave approvals
 * - Leave balance tracking
 *
 * Import from this file only - internal implementation may change.
 */

// Components
export { LeaveRequestCard } from "@/components/LeaveRequestCard";
export { GroupedLeaveList } from "@/components/GroupedLeaveList";

// Services & Utilities
export {
  applyFiltersToLeaveRequests,
  filterAndGroupLeaveRequests,
  hasActiveFilters,
  getActiveFilterCount,
} from "@/utils/leave-request-filters";

export {
  groupLeaveRequests,
  sortLeaveRequests,
  transformDbLeaveRequest,
  getDateBucket,
  getDateBucketLabel,
  isLeaveRequestOverdue,
  getDaysUntilLeave,
  type LeaveRequest,
  type GroupByDimension,
  type SortOption,
  type GroupedLeaveRequests,
} from "@/utils/leave-requests";
