"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HStack, VStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import type { LeaveRequestCardData } from "./LeaveRequestCard";

/**
 * Bulk action type
 */
export type BulkActionType =
  | "approve_all"
  | "reject_all"
  | "change_status"
  | "export";

/**
 * Props for BatchActionsPanel component
 */
export interface BatchActionsPanelProps {
  /**
   * Selected leave request IDs
   */
  selectedIds: Set<string>;
  /**
   * All leave requests (for displaying affected items)
   */
  leaveRequests: LeaveRequestCardData[];
  /**
   * Callback when selection changes
   */
  onSelectionChange?: (selectedIds: Set<string>) => void;
  /**
   * Callback when bulk approve is triggered
   */
  onBulkApprove?: (ids: string[]) => void;
  /**
   * Callback when bulk reject is triggered
   */
  onBulkReject?: (ids: string[]) => void;
  /**
   * Callback when bulk status change is triggered
   */
  onBulkStatusChange?: (ids: string[], newStatus: string) => void;
  /**
   * Callback when export is triggered
   */
  onExport?: (ids: string[]) => void;
  /**
   * Current user role for permission checks
   */
  userRole?: "account_manager" | "hr" | "admin" | "employee";
  /**
   * Whether to show the panel (auto-hides when no selection)
   */
  showWhenEmpty?: boolean;
  /**
   * Custom className
   */
  className?: string;
}

/**
 * Get affected leave requests summary
 */
function getAffectedSummary(
  selectedIds: Set<string>,
  leaveRequests: LeaveRequestCardData[]
): {
  count: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  sample: LeaveRequestCardData[];
} {
  const selected = leaveRequests.filter((req) => selectedIds.has(req.id));
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};

  selected.forEach((req) => {
    byStatus[req.status] = (byStatus[req.status] || 0) + 1;
    byType[req.leaveType] = (byType[req.leaveType] || 0) + 1;
  });

  return {
    count: selected.length,
    byStatus,
    byType,
    sample: selected.slice(0, 5), // Show first 5 as sample
  };
}

/**
 * Check if user can perform bulk actions
 */
function canPerformBulkAction(
  action: BulkActionType,
  userRole?: BatchActionsPanelProps["userRole"],
  selectedRequests?: LeaveRequestCardData[]
): boolean {
  if (!userRole || userRole === "employee") return false;

  if (action === "approve_all" || action === "reject_all") {
    // Check if all selected requests can be approved/rejected by this role
    if (!selectedRequests) return false;

    if (userRole === "account_manager") {
      // Can only approve/reject pending requests
      return selectedRequests.every((req) => req.status === "pending");
    }

    if (userRole === "hr" || userRole === "admin") {
      // Can approve/reject manager-approved requests
      return selectedRequests.every(
        (req) => req.status === "approved_by_manager"
      );
    }
  }

  if (action === "change_status") {
    return userRole === "hr" || userRole === "admin";
  }

  if (action === "export") {
    return true; // Everyone can export
  }

  return false;
}

/**
 * BatchActionsPanel component
 * Sticky panel at bottom showing bulk actions for selected leave requests
 */
export function BatchActionsPanel({
  selectedIds,
  leaveRequests,
  onSelectionChange,
  onBulkApprove,
  onBulkReject,
  onBulkStatusChange,
  onExport,
  userRole,
  showWhenEmpty = false,
  className,
}: BatchActionsPanelProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [showExportDialog, setShowExportDialog] = useState(false);

  const selectedArray = Array.from(selectedIds);
  const hasSelection = selectedIds.size > 0;

  // Get affected requests
  const affectedRequests = useMemo(
    () => leaveRequests.filter((req) => selectedIds.has(req.id)),
    [leaveRequests, selectedIds]
  );

  const summary = useMemo(
    () => getAffectedSummary(selectedIds, leaveRequests),
    [selectedIds, leaveRequests]
  );

  // Check permissions
  const canApprove = canPerformBulkAction(
    "approve_all",
    userRole,
    affectedRequests
  );
  const canReject = canPerformBulkAction(
    "reject_all",
    userRole,
    affectedRequests
  );
  const canChangeStatus = canPerformBulkAction(
    "change_status",
    userRole,
    affectedRequests
  );
  const canExport = canPerformBulkAction("export", userRole);

  // Clear selection
  const handleClearSelection = () => {
    onSelectionChange?.(new Set());
  };

  // Handle bulk approve
  const handleApprove = () => {
    if (onBulkApprove && selectedArray.length > 0) {
      onBulkApprove(selectedArray);
      setShowApproveDialog(false);
      handleClearSelection();
    }
  };

  // Handle bulk reject
  const handleReject = () => {
    if (onBulkReject && selectedArray.length > 0) {
      onBulkReject(selectedArray);
      setShowRejectDialog(false);
      handleClearSelection();
    }
  };

  // Handle status change
  const handleStatusChange = () => {
    if (onBulkStatusChange && selectedArray.length > 0 && newStatus) {
      onBulkStatusChange(selectedArray, newStatus);
      setShowStatusDialog(false);
      setNewStatus("");
      handleClearSelection();
    }
  };

  // Handle export
  const handleExport = () => {
    if (onExport && selectedArray.length > 0) {
      onExport(selectedArray);
      setShowExportDialog(false);
    }
  };

  // Don't show panel if no selection and showWhenEmpty is false
  if (!hasSelection && !showWhenEmpty) {
    return null;
  }

  return (
    <>
      {/* Sticky Panel */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-lg transition-all",
          hasSelection
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0",
          className
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 py-3 max-w-7xl">
          <HStack justify="between" align="center" className="flex-wrap gap-3">
            {/* Selection Info */}
            <HStack gap="3" align="center" className="flex-1 min-w-0">
              <Badge variant="default" className="text-sm font-semibold">
                {selectedIds.size} selected
              </Badge>
              {hasSelection && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="text-xs"
                >
                  <Icon name="X" size={IconSizes.xs} />
                  Clear
                </Button>
              )}
            </HStack>

            {/* Action Buttons */}
            <HStack gap="2" align="center" className="flex-wrap">
              {canApprove && (
                <Button
                  size="sm"
                  onClick={() => setShowApproveDialog(true)}
                  disabled={!hasSelection}
                >
                  <Icon name="Check" size={IconSizes.sm} />
                  Approve All
                </Button>
              )}

              {canReject && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={!hasSelection}
                >
                  <Icon name="X" size={IconSizes.sm} />
                  Reject All
                </Button>
              )}

              {canChangeStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusDialog(true)}
                  disabled={!hasSelection}
                >
                  <Icon name="Gear" size={IconSizes.sm} />
                  Change Status
                </Button>
              )}

              {canExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                  disabled={!hasSelection}
                >
                  <Icon name="FileText" size={IconSizes.sm} />
                  Export
                </Button>
              )}
            </HStack>
          </HStack>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve Selected Leave Requests?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to approve <strong>{selectedIds.size}</strong> leave
              request{selectedIds.size !== 1 ? "s" : ""}. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Affected Requests Summary */}
          {summary.count > 0 && (
            <VStack gap="2" align="start" className="max-h-48 overflow-y-auto">
              <BodySmall className="font-semibold">
                Affected Requests:
              </BodySmall>
              <div className="space-y-1 text-sm">
                {summary.sample.map((req) => (
                  <div key={req.id} className="flex justify-between">
                    <span>{req.employeeName}</span>
                    <Badge variant="outline" className="text-xs">
                      {req.leaveType}
                    </Badge>
                  </div>
                ))}
                {summary.count > summary.sample.length && (
                  <Caption className="text-muted-foreground">
                    ...and {summary.count - summary.sample.length} more
                  </Caption>
                )}
              </div>

              {/* Status Breakdown */}
              <div className="mt-2 pt-2 border-t w-full">
                <Caption className="text-xs text-muted-foreground">
                  Status breakdown:{" "}
                  {Object.entries(summary.byStatus)
                    .map(([status, count]) => `${status}: ${count}`)
                    .join(", ")}
                </Caption>
              </div>
            </VStack>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>
              Approve {selectedIds.size} Request
              {selectedIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Selected Leave Requests?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject <strong>{selectedIds.size}</strong> leave
              request{selectedIds.size !== 1 ? "s" : ""}. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Affected Requests Summary */}
          {summary.count > 0 && (
            <VStack gap="2" align="start" className="max-h-48 overflow-y-auto">
              <BodySmall className="font-semibold">
                Affected Requests:
              </BodySmall>
              <div className="space-y-1 text-sm">
                {summary.sample.map((req) => (
                  <div key={req.id} className="flex justify-between">
                    <span>{req.employeeName}</span>
                    <Badge variant="outline" className="text-xs">
                      {req.leaveType}
                    </Badge>
                  </div>
                ))}
                {summary.count > summary.sample.length && (
                  <Caption className="text-muted-foreground">
                    ...and {summary.count - summary.sample.length} more
                  </Caption>
                )}
              </div>
            </VStack>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject {selectedIds.size} Request
              {selectedIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Status Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change Status for Selected Requests?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select a new status for <strong>{selectedIds.size}</strong> leave
              request{selectedIds.size !== 1 ? "s" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Status Selector */}
          <VStack gap="3" align="start">
            <div className="w-full">
              <label className="text-sm font-medium mb-2 block">
                New Status
              </label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved_by_manager">
                    Manager Approved
                  </SelectItem>
                  <SelectItem value="approved_by_hr">HR Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Affected Requests Summary */}
            {summary.count > 0 && (
              <VStack
                gap="2"
                align="start"
                className="max-h-48 overflow-y-auto w-full"
              >
                <BodySmall className="font-semibold">
                  Affected Requests:
                </BodySmall>
                <div className="space-y-1 text-sm">
                  {summary.sample.map((req) => (
                    <div key={req.id} className="flex justify-between">
                      <span>{req.employeeName}</span>
                      <Badge variant="outline" className="text-xs">
                        {req.status}
                      </Badge>
                    </div>
                  ))}
                  {summary.count > summary.sample.length && (
                    <Caption className="text-muted-foreground">
                      ...and {summary.count - summary.sample.length} more
                    </Caption>
                  )}
                </div>
              </VStack>
            )}
          </VStack>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewStatus("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusChange}
              disabled={!newStatus}
            >
              Change Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Selected Leave Requests?</AlertDialogTitle>
            <AlertDialogDescription>
              Export <strong>{selectedIds.size}</strong> leave request
              {selectedIds.size !== 1 ? "s" : ""} to a file.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Export Options */}
          <VStack gap="2" align="start" className="max-h-48 overflow-y-auto">
            <BodySmall className="font-semibold">Export Format:</BodySmall>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value="csv"
                  defaultChecked
                />
                <span>CSV (Excel compatible)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="export-format" value="json" />
                <span>JSON (Data export)</span>
              </label>
            </div>

            {/* Affected Requests Summary */}
            {summary.count > 0 && (
              <>
                <BodySmall className="font-semibold mt-2">
                  Will Export ({summary.count}):
                </BodySmall>
                <div className="space-y-1 text-sm">
                  {summary.sample.map((req) => (
                    <div key={req.id} className="flex justify-between">
                      <span>{req.employeeName}</span>
                      <Badge variant="outline" className="text-xs">
                        {req.leaveType}
                      </Badge>
                    </div>
                  ))}
                  {summary.count > summary.sample.length && (
                    <Caption className="text-muted-foreground">
                      ...and {summary.count - summary.sample.length} more
                    </Caption>
                  )}
                </div>
              </>
            )}
          </VStack>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport}>
              <Icon name="FileText" size={IconSizes.sm} />
              Export {selectedIds.size} Request
              {selectedIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}