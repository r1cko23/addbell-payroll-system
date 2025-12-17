/**
 * Example usage of the leave request grouping utility functions
 *
 * This file demonstrates how to use the groupLeaveRequests function
 * with various grouping and sorting options.
 */

import {
  groupLeaveRequests,
  transformDbLeaveRequest,
  getDateBucket,
  formatDateRange,
  isLeaveRequestOverdue,
  getDaysUntilLeave,
  type LeaveRequest,
  type GroupByDimension,
  type SortOption,
} from "./leave-requests";

// Example: Transform database results to utility format
export function exampleTransformDbResults() {
  // Simulated database result (snake_case)
  const dbResult = {
    id: "123",
    employee_id: "EMP001",
    start_date: "2024-01-15",
    end_date: "2024-01-17",
    status: "pending",
    leave_type: "SIL",
    account_manager_id: null,
    hr_approver_id: null,
  };

  const transformed = transformDbLeaveRequest(
    dbResult,
    "John Doe",
    "Engineering"
  );

  console.log("Transformed request:", transformed);
}

// Example: Group by date with date-asc sorting
export function exampleGroupByDate() {
  const requests: LeaveRequest[] = [
    {
      id: "1",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      status: "pending",
      leaveType: "SIL",
    },
    {
      id: "2",
      employeeName: "Jane Smith",
      employeeId: "EMP002",
      startDate: "2024-01-20",
      endDate: "2024-01-22",
      status: "approved_by_manager",
      leaveType: "LWOP",
    },
  ];

  const grouped = groupLeaveRequests(requests, "date", "date-asc");

  // Result structure:
  // {
  //   groups: [
  //     {
  //       key: 'This Week',
  //       label: 'This Week',
  //       count: 2,
  //       items: [...]
  //     }
  //   ]
  // }

  return grouped;
}

// Example: Group by status with name sorting
export function exampleGroupByStatus() {
  const requests: LeaveRequest[] = [
    {
      id: "1",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      status: "pending",
      leaveType: "SIL",
    },
    {
      id: "2",
      employeeName: "Jane Smith",
      employeeId: "EMP002",
      startDate: "2024-01-20",
      endDate: "2024-01-22",
      status: "approved_by_hr",
      leaveType: "LWOP",
    },
  ];

  const grouped = groupLeaveRequests(requests, "status", "name");

  // Groups will be ordered: pending, approved_by_manager, approved_by_hr, rejected, cancelled
  // Within each group, items sorted alphabetically by employee name

  return grouped;
}

// Example: Group by employee with date-desc sorting
export function exampleGroupByEmployee() {
  const requests: LeaveRequest[] = [
    {
      id: "1",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      status: "pending",
      leaveType: "SIL",
    },
    {
      id: "2",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2024-01-25",
      endDate: "2024-01-27",
      status: "approved_by_manager",
      leaveType: "SIL",
    },
  ];

  const grouped = groupLeaveRequests(requests, "employee", "date-desc");

  // All requests for EMP001 grouped together, sorted by date descending

  return grouped;
}

// Example: Group by department
export function exampleGroupByDepartment() {
  const requests: LeaveRequest[] = [
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
    },
  ];

  const grouped = groupLeaveRequests(requests, "department", "name");

  return grouped;
}

// Example: Using helper functions
export function exampleHelperFunctions() {
  const startDate = "2024-01-15";
  const endDate = "2024-01-17";

  // Get date bucket
  const bucket = getDateBucket(startDate);
  console.log("Date bucket:", bucket); // e.g., 'This Week'

  // Format date range
  const formatted = formatDateRange(startDate, endDate);
  console.log("Formatted range:", formatted); // e.g., 'Jan 15 - Jan 17, 2024'

  // Check if overdue
  const overdue = isLeaveRequestOverdue(startDate);
  console.log("Is overdue:", overdue);

  // Get days until leave
  const daysUntil = getDaysUntilLeave(startDate);
  console.log("Days until leave:", daysUntil);
}

// Example: Rendering grouped data in React
export function exampleReactRendering() {
  const requests: LeaveRequest[] = []; // Your leave requests

  const grouped = groupLeaveRequests(requests, "date", "date-asc");

  // Render structure:
  // return (
  //   <div>
  //     {grouped.groups.map((group) => (
  //       <div key={group.key}>
  //         <h2>{group.label} ({group.count})</h2>
  //         {group.items.map((request) => (
  //           <div key={request.id}>
  //             {request.employeeName} - {formatDateRange(request.startDate, request.endDate)}
  //           </div>
  //         ))}
  //       </div>
  //     ))}
  //   </div>
  // );
}











