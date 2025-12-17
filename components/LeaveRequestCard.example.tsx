/**
 * Example usage of the LeaveRequestCard component
 *
 * This file demonstrates how to use LeaveRequestCard with various configurations
 */

"use client";

import {
  LeaveRequestCard,
  type LeaveRequestCardData,
} from "./LeaveRequestCard";
import { VStack } from "@/components/ui/stack";

/**
 * Example: Basic usage
 */
export function BasicLeaveRequestCardExample() {
  const request: LeaveRequestCardData = {
    id: "1",
    employeeName: "John Doe",
    employeeId: "EMP001",
    startDate: "2024-01-15",
    endDate: "2024-01-17",
    status: "pending",
    leaveType: "SIL",
    totalDays: 3,
    reason: "Family emergency",
    department: "Engineering",
    availableCredits: 5,
  };

  return (
    <div className="max-w-md">
      <LeaveRequestCard
        request={request}
        onViewDetails={(id) => console.log("View details:", id)}
      />
    </div>
  );
}

/**
 * Example: With action buttons for manager
 */
export function ManagerLeaveRequestCardExample() {
  const request: LeaveRequestCardData = {
    id: "2",
    employeeName: "Jane Smith",
    employeeId: "EMP002",
    startDate: "2024-01-20",
    endDate: "2024-01-22",
    status: "pending",
    leaveType: "LWOP",
    totalDays: 3,
    reason: "Personal matters",
    department: "Sales",
  };

  return (
    <div className="max-w-md">
      <LeaveRequestCard
        request={request}
        userRole="account_manager"
        showActions={true}
        onApprove={(id, level) => {
          console.log("Approve:", id, level);
        }}
        onReject={(id) => {
          console.log("Reject:", id);
        }}
        onViewDetails={(id) => {
          console.log("View details:", id);
        }}
      />
    </div>
  );
}

/**
 * Example: HR approved request
 */
export function HRApprovedLeaveRequestCardExample() {
  const request: LeaveRequestCardData = {
    id: "3",
    employeeName: "Bob Johnson",
    employeeId: "EMP003",
    startDate: "2024-01-25",
    endDate: "2024-01-27",
    status: "approved_by_hr",
    leaveType: "SIL",
    totalDays: 3,
    reason: "Vacation",
    department: "HR",
    approvedByManager: true,
    approvedByHR: true,
    approvedByManagerName: "Alice Manager",
    approvedByHRName: "Carol HR",
    availableCredits: 10,
  };

  return (
    <div className="max-w-md">
      <LeaveRequestCard
        request={request}
        userRole="hr"
        showActions={false}
        onViewDetails={(id) => console.log("View details:", id)}
      />
    </div>
  );
}

/**
 * Example: Off-setting leave with hours
 */
export function OffsettingLeaveRequestCardExample() {
  const request: LeaveRequestCardData = {
    id: "4",
    employeeName: "Alice Williams",
    employeeId: "EMP004",
    startDate: "2024-01-18",
    endDate: "2024-01-18",
    status: "pending",
    leaveType: "Off-setting",
    totalHours: 8,
    reason: "Using offset hours",
    department: "Operations",
    availableOffsetHours: 16.5,
  };

  return (
    <div className="max-w-md">
      <LeaveRequestCard
        request={request}
        userRole="account_manager"
        showActions={true}
        onApprove={(id, level) => console.log("Approve:", id, level)}
        onReject={(id) => console.log("Reject:", id)}
        onViewDetails={(id) => console.log("View details:", id)}
      />
    </div>
  );
}

/**
 * Example: Overdue request
 */
export function OverdueLeaveRequestCardExample() {
  const request: LeaveRequestCardData = {
    id: "5",
    employeeName: "Charlie Brown",
    employeeId: "EMP005",
    startDate: "2024-01-05", // Past date
    endDate: "2024-01-07",
    status: "pending",
    leaveType: "SIL",
    totalDays: 3,
    reason: "Sick leave",
    department: "IT",
    availableCredits: 2,
  };

  return (
    <div className="max-w-md">
      <LeaveRequestCard
        request={request}
        userRole="account_manager"
        showActions={true}
        onApprove={(id, level) => console.log("Approve:", id, level)}
        onReject={(id) => console.log("Reject:", id)}
        onViewDetails={(id) => console.log("View details:", id)}
      />
    </div>
  );
}

/**
 * Example: Rejected request
 */
export function RejectedLeaveRequestCardExample() {
  const request: LeaveRequestCardData = {
    id: "6",
    employeeName: "David Lee",
    employeeId: "EMP006",
    startDate: "2024-01-30",
    endDate: "2024-02-01",
    status: "rejected",
    leaveType: "LWOP",
    totalDays: 3,
    reason: "Personal leave",
    department: "Marketing",
    rejectedBy: "Manager Name",
    rejectionReason: "Insufficient notice period",
  };

  return (
    <div className="max-w-md">
      <LeaveRequestCard
        request={request}
        showActions={false}
        onViewDetails={(id) => console.log("View details:", id)}
      />
    </div>
  );
}

/**
 * Example: Maternity leave
 */
export function MaternityLeaveRequestCardExample() {
  const request: LeaveRequestCardData = {
    id: "7",
    employeeName: "Emma Davis",
    employeeId: "EMP007",
    startDate: "2024-02-01",
    endDate: "2024-04-30",
    status: "approved_by_manager",
    leaveType: "Maternity Leave",
    totalDays: 60,
    reason: "Maternity leave",
    department: "HR",
    approvedByManager: true,
    approvedByManagerName: "Manager Name",
  };

  return (
    <div className="max-w-md">
      <LeaveRequestCard
        request={request}
        userRole="hr"
        showActions={true}
        onApprove={(id, level) => console.log("Approve:", id, level)}
        onReject={(id) => console.log("Reject:", id)}
        onViewDetails={(id) => console.log("View details:", id)}
      />
    </div>
  );
}

/**
 * Example: Grid of leave request cards
 */
export function LeaveRequestCardGridExample() {
  const requests: LeaveRequestCardData[] = [
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
      availableCredits: 5,
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
      department: "Sales",
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
      department: "HR",
      approvedByManager: true,
      approvedByHR: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {requests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          userRole="account_manager"
          showActions={true}
          onApprove={(id, level) => console.log("Approve:", id, level)}
          onReject={(id) => console.log("Reject:", id)}
          onViewDetails={(id) => console.log("View details:", id)}
        />
      ))}
    </div>
  );
}











