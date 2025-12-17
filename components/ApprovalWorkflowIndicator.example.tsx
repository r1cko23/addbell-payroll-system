/**
 * ApprovalWorkflowIndicator Component Examples
 *
 * This file demonstrates various usage patterns for the ApprovalWorkflowIndicator component.
 */

import { ApprovalWorkflowIndicator } from "./ApprovalWorkflowIndicator";
import type { ApprovalInfo } from "./ApprovalWorkflowIndicator";

// Example 1: Pending Request
export function PendingExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Pending Request</h2>
      <ApprovalWorkflowIndicator
        status="pending"
        createdAt="2025-12-10T08:00:00Z"
      />
    </div>
  );
}

// Example 2: Manager Approved
export function ManagerApprovedExample() {
  const managerApproval: ApprovalInfo = {
    approverId: "user-123",
    approverName: "John Manager",
    approvedAt: "2025-12-10T10:30:00Z",
    notes: "Approved. Employee has sufficient SIL credits.",
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Manager Approved</h2>
      <ApprovalWorkflowIndicator
        status="approved_by_manager"
        managerApproval={managerApproval}
        createdAt="2025-12-10T08:00:00Z"
      />
    </div>
  );
}

// Example 3: Fully Approved
export function FullyApprovedExample() {
  const managerApproval: ApprovalInfo = {
    approverId: "user-123",
    approverName: "John Manager",
    approvedAt: "2025-12-10T10:30:00Z",
    notes: "Approved. Employee has sufficient credits.",
  };

  const hrApproval: ApprovalInfo = {
    approverId: "user-456",
    approverName: "Jane HR",
    approvedAt: "2025-12-11T14:20:00Z",
    notes: "Final approval granted. Credits deducted.",
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Fully Approved</h2>
      <ApprovalWorkflowIndicator
        status="approved_by_hr"
        managerApproval={managerApproval}
        hrApproval={hrApproval}
        createdAt="2025-12-10T08:00:00Z"
      />
    </div>
  );
}

// Example 4: Rejected Request
export function RejectedExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Rejected Request</h2>
      <ApprovalWorkflowIndicator
        status="rejected"
        rejection={{
          rejectedBy: "user-123",
          rejectedAt: "2025-12-10T10:30:00Z",
          rejectionReason:
            "Insufficient leave credits available. Employee has only 2 days remaining but requested 5 days.",
        }}
        createdAt="2025-12-10T08:00:00Z"
      />
    </div>
  );
}

// Example 5: Cancelled Request
export function CancelledExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Cancelled Request</h2>
      <ApprovalWorkflowIndicator
        status="cancelled"
        createdAt="2025-12-10T08:00:00Z"
      />
    </div>
  );
}

// Example 6: Without Details
export function WithoutDetailsExample() {
  const managerApproval: ApprovalInfo = {
    approverId: "user-123",
    approverName: "John Manager",
    approvedAt: "2025-12-10T10:30:00Z",
    notes: "Approved.",
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Without Details</h2>
      <ApprovalWorkflowIndicator
        status="approved_by_manager"
        managerApproval={managerApproval}
        createdAt="2025-12-10T08:00:00Z"
        showDetails={false}
      />
    </div>
  );
}

// Example 7: Integration with Database Structure
export function DatabaseIntegrationExample() {
  // Simulated database structure (snake_case)
  const dbRequest = {
    id: "req-123",
    status: "approved_by_hr",
    account_manager_id: "user-123",
    account_manager_approved_at: "2025-12-10T10:30:00Z",
    account_manager_notes: "Approved. Employee has sufficient credits.",
    hr_approved_by: "user-456",
    hr_approved_at: "2025-12-11T14:20:00Z",
    hr_notes: "Final approval granted.",
    created_at: "2025-12-10T08:00:00Z",
  };

  // Approver names from joins (would come from database query)
  const approverNames = {
    "user-123": "John Manager",
    "user-456": "Jane HR",
  };

  // Transform to component props
  const managerApproval: ApprovalInfo | undefined = dbRequest.account_manager_id
    ? {
        approverId: dbRequest.account_manager_id,
        approverName:
          approverNames[
            dbRequest.account_manager_id as keyof typeof approverNames
          ],
        approvedAt: dbRequest.account_manager_approved_at,
        notes: dbRequest.account_manager_notes,
      }
    : undefined;

  const hrApproval: ApprovalInfo | undefined = dbRequest.hr_approved_by
    ? {
        approverId: dbRequest.hr_approved_by,
        approverName:
          approverNames[dbRequest.hr_approved_by as keyof typeof approverNames],
        approvedAt: dbRequest.hr_approved_at,
        notes: dbRequest.hr_notes,
      }
    : undefined;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Database Integration</h2>
      <ApprovalWorkflowIndicator
        status={dbRequest.status as any}
        managerApproval={managerApproval}
        hrApproval={hrApproval}
        createdAt={dbRequest.created_at}
      />
    </div>
  );
}

// Example 8: In Leave Request Card
export function InLeaveRequestCardExample() {
  const leaveRequest = {
    id: "req-123",
    employeeName: "John Doe",
    startDate: "2025-12-15",
    endDate: "2025-12-20",
    status: "approved_by_hr",
    leaveType: "SIL",
    // Approval data
    managerApproval: {
      approverId: "user-123",
      approverName: "Jane Manager",
      approvedAt: "2025-12-10T10:30:00Z",
      notes: "Approved.",
    },
    hrApproval: {
      approverId: "user-456",
      approverName: "Bob HR",
      approvedAt: "2025-12-11T14:20:00Z",
      notes: "Final approval.",
    },
    createdAt: "2025-12-10T08:00:00Z",
  };

  return (
    <div className="p-4 space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">{leaveRequest.employeeName}</h3>
        <p className="text-sm text-muted-foreground">
          {leaveRequest.startDate} to {leaveRequest.endDate}
        </p>
        <p className="text-sm">{leaveRequest.leaveType}</p>
      </div>

      <ApprovalWorkflowIndicator
        status={leaveRequest.status as any}
        managerApproval={leaveRequest.managerApproval}
        hrApproval={leaveRequest.hrApproval}
        createdAt={leaveRequest.createdAt}
      />
    </div>
  );
}

// Example 9: All Statuses Comparison
export function AllStatusesExample() {
  const baseDate = "2025-12-10T08:00:00Z";
  const managerApproval: ApprovalInfo = {
    approverId: "user-123",
    approverName: "John Manager",
    approvedAt: "2025-12-10T10:30:00Z",
    notes: "Approved.",
  };
  const hrApproval: ApprovalInfo = {
    approverId: "user-456",
    approverName: "Jane HR",
    approvedAt: "2025-12-11T14:20:00Z",
    notes: "Final approval.",
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold">All Statuses Comparison</h2>

      <div>
        <h3 className="font-semibold mb-2">Pending</h3>
        <ApprovalWorkflowIndicator
          status="pending"
          createdAt={baseDate}
          showDetails={false}
        />
      </div>

      <div>
        <h3 className="font-semibold mb-2">Manager Approved</h3>
        <ApprovalWorkflowIndicator
          status="approved_by_manager"
          managerApproval={managerApproval}
          createdAt={baseDate}
          showDetails={false}
        />
      </div>

      <div>
        <h3 className="font-semibold mb-2">Fully Approved</h3>
        <ApprovalWorkflowIndicator
          status="approved_by_hr"
          managerApproval={managerApproval}
          hrApproval={hrApproval}
          createdAt={baseDate}
          showDetails={false}
        />
      </div>

      <div>
        <h3 className="font-semibold mb-2">Rejected</h3>
        <ApprovalWorkflowIndicator
          status="rejected"
          rejection={{
            rejectedBy: "user-123",
            rejectedAt: "2025-12-10T10:30:00Z",
            rejectionReason: "Insufficient credits.",
          }}
          createdAt={baseDate}
          showDetails={false}
        />
      </div>
    </div>
  );
}
