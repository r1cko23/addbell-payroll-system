/**
 * BatchActionsPanel Component Examples
 *
 * This file demonstrates various usage patterns for the BatchActionsPanel component.
 */

import { useState } from "react";
import { BatchActionsPanel } from "./BatchActionsPanel";
import { LeaveRequestCard } from "./LeaveRequestCard";
import { useSelectionState } from "@/hooks/useSelectionState";
import type { LeaveRequestCardData } from "./LeaveRequestCard";

// Example 1: Basic Usage
export function BasicExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([
    {
      id: "1",
      employeeName: "John Doe",
      employeeId: "EMP001",
      startDate: "2025-12-15",
      endDate: "2025-12-20",
      status: "pending",
      leaveType: "SIL",
    },
    {
      id: "2",
      employeeName: "Jane Smith",
      employeeId: "EMP002",
      startDate: "2025-12-18",
      endDate: "2025-12-22",
      status: "pending",
      leaveType: "LWOP",
    },
  ]);

  const { selectedIds, toggleSelection, isSelected } =
    useSelectionState(leaveRequests);

  return (
    <div className="p-4 space-y-4 pb-24">
      <h2 className="text-xl font-bold mb-4">Basic Batch Actions</h2>

      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onBulkApprove={(ids) => console.log("Approve:", ids)}
        onBulkReject={(ids) => console.log("Reject:", ids)}
        userRole="hr"
      />
    </div>
  );
}

// Example 2: With Select All
export function WithSelectAllExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([]);
  const {
    selectedIds,
    toggleSelection,
    isSelected,
    allSelected,
    toggleSelectAll,
  } = useSelectionState(leaveRequests);

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Leave Requests</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4"
          />
          <span className="text-sm">Select All</span>
        </label>
      </div>

      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onBulkApprove={(ids) => console.log("Approve:", ids)}
        userRole="hr"
      />
    </div>
  );
}

// Example 3: With Filtering
export function WithFilteringExample() {
  const [allRequests] = useState<LeaveRequestCardData[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<
    LeaveRequestCardData[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selection persists across filtering
  const { selectedIds, toggleSelection, isSelected } =
    useSelectionState(allRequests);

  // Filter requests
  const applyFilter = () => {
    if (statusFilter === "all") {
      setFilteredRequests(allRequests);
    } else {
      setFilteredRequests(
        allRequests.filter((req) => req.status === statusFilter)
      );
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            applyFilter();
          }}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved_by_manager">Manager Approved</option>
          <option value="approved_by_hr">HR Approved</option>
        </select>
      </div>

      {filteredRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={allRequests}
        onBulkApprove={(ids) => console.log("Approve:", ids)}
        userRole="hr"
      />
    </div>
  );
}

// Example 4: Account Manager Role
export function AccountManagerExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([]);
  const { selectedIds, toggleSelection, isSelected } =
    useSelectionState(leaveRequests);

  return (
    <div className="p-4 space-y-4 pb-24">
      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onBulkApprove={(ids) => console.log("Approve:", ids)}
        onBulkReject={(ids) => console.log("Reject:", ids)}
        userRole="account_manager"
      />
    </div>
  );
}

// Example 5: With Status Change
export function WithStatusChangeExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([]);
  const { selectedIds, toggleSelection, isSelected } =
    useSelectionState(leaveRequests);

  const handleStatusChange = async (ids: string[], newStatus: string) => {
    console.log(`Changing ${ids.length} requests to ${newStatus}`);
    // Implement status change logic
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onBulkStatusChange={handleStatusChange}
        userRole="admin"
      />
    </div>
  );
}

// Example 6: With Export
export function WithExportExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([]);
  const { selectedIds, toggleSelection, isSelected } =
    useSelectionState(leaveRequests);

  const handleExport = (ids: string[]) => {
    const selected = leaveRequests.filter((req) => ids.includes(req.id));
    // Convert to CSV
    const csv = convertToCSV(selected);
    downloadCSV(csv, "leave_requests.csv");
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onExport={handleExport}
        userRole="hr"
      />
    </div>
  );
}

// Helper functions (mock implementations)
function convertToCSV(data: LeaveRequestCardData[]): string {
  const headers = [
    "ID",
    "Employee",
    "Start Date",
    "End Date",
    "Type",
    "Status",
  ];
  const rows = data.map((req) => [
    req.id,
    req.employeeName,
    req.startDate,
    req.endDate,
    req.leaveType,
    req.status,
  ]);
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Example 7: Full Integration
export function FullIntegrationExample() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestCardData[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<"hr" | "account_manager" | "admin">(
    "hr"
  );

  const {
    selectedIds,
    toggleSelection,
    clearSelection,
    isSelected,
    allSelected,
    toggleSelectAll,
  } = useSelectionState(leaveRequests);

  const handleBulkApprove = async (ids: string[]) => {
    setLoading(true);
    try {
      // API call
      await Promise.all(ids.map((id) => approveLeaveRequest(id)));
      clearSelection();
      // Refresh
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = async (ids: string[]) => {
    setLoading(true);
    try {
      await Promise.all(ids.map((id) => rejectLeaveRequest(id)));
      clearSelection();
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusChange = async (ids: string[], newStatus: string) => {
    setLoading(true);
    try {
      await Promise.all(
        ids.map((id) => updateLeaveRequestStatus(id, newStatus))
      );
      clearSelection();
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (ids: string[]) => {
    const selected = leaveRequests.filter((req) => ids.includes(req.id));
    const csv = convertToCSV(selected);
    downloadCSV(csv, `leave_requests_${new Date().toISOString()}.csv`);
  };

  const fetchLeaveRequests = () => {
    // Fetch logic
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Leave Approval</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={loading}
            className="w-4 h-4"
          />
          <span className="text-sm">Select All</span>
        </label>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Processing...
        </div>
      )}

      {/* Leave Request Cards */}
      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          userRole={userRole}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
          onApprove={(id, level) => handleBulkApprove([id])}
          onReject={(id) => handleBulkReject([id])}
        />
      ))}

      {/* Batch Actions Panel */}
      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onBulkApprove={handleBulkApprove}
        onBulkReject={handleBulkReject}
        onBulkStatusChange={handleBulkStatusChange}
        onExport={handleExport}
        userRole={userRole}
      />
    </div>
  );
}

// Mock API functions
async function approveLeaveRequest(id: string) {
  return Promise.resolve();
}

async function rejectLeaveRequest(id: string) {
  return Promise.resolve();
}

async function updateLeaveRequestStatus(id: string, status: string) {
  return Promise.resolve();
}
