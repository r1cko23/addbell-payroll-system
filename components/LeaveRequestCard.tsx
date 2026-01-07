"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HStack, VStack } from "@/components/ui/stack";
import { BodySmall, Caption, H4 } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import { getInitials } from "@/utils/format";
import { formatDateRange, isLeaveRequestOverdue } from "@/utils/leave-requests";

/**
 * Leave request data interface
 */
export interface LeaveRequestCardData {
  id: string;
  employeeName: string;
  employeeId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  selectedDates?: string[] | null; // Array of ISO date strings for non-consecutive dates
  status:
    | "pending"
    | "approved_by_manager"
    | "approved_by_hr"
    | "rejected"
    | "cancelled";
  leaveType:
    | "SIL"
    | "LWOP"
    | "Maternity Leave"
    | "Paternity Leave"
  totalDays?: number;
  totalHours?: number;
  reason?: string | null;
  department?: string;
  location?: string;
  address?: string;
  approvedByManager?: boolean;
  approvedByHR?: boolean;
  // Leave balance information
  availableCredits?: number; // For SIL
  // Approval information
  approvedByManagerName?: string;
  approvedByHRName?: string;
  rejectedBy?: string;
  rejectionReason?: string | null;
}

/**
 * Props for LeaveRequestCard component
 */
export interface LeaveRequestCardProps {
  /**
   * Leave request data
   */
  request: LeaveRequestCardData;
  /**
   * Current user role for context-aware actions
   */
  userRole?: "account_manager" | "hr" | "admin" | "employee";
  /**
   * Callback when approve button is clicked
   */
  onApprove?: (requestId: string, level: "manager" | "hr") => void;
  /**
   * Callback when reject button is clicked
   */
  onReject?: (requestId: string) => void;
  /**
   * Callback when view details button is clicked
   */
  onViewDetails?: (requestId: string) => void;
  /**
   * Whether to show action buttons
   */
  showActions?: boolean;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Whether card is clickable (opens details)
   */
  clickable?: boolean;
  /**
   * Whether to show checkbox for batch selection
   */
  showCheckbox?: boolean;
  /**
   * Whether this item is selected
   */
  isSelected?: boolean;
  /**
   * Callback when checkbox is toggled
   */
  onSelectionToggle?: (id: string) => void;
}

/**
 * Get color configuration for leave type
 */
function getLeaveTypeColor(leaveType: LeaveRequestCardData["leaveType"]) {
  const colors = {
    SIL: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
    },
    LWOP: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-700",
      badge: "bg-purple-100 text-purple-800 border-purple-200",
    },
    "Maternity Leave": {
      bg: "bg-pink-50",
      border: "border-pink-200",
      text: "text-pink-700",
      badge: "bg-pink-100 text-pink-800 border-pink-200",
    },
    "Paternity Leave": {
      bg: "bg-cyan-50",
      border: "border-cyan-200",
      text: "text-cyan-700",
      badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
    },
  };
  return colors[leaveType] || colors.SIL;
}

/**
 * Get status badge configuration
 */
function getStatusBadge(status: LeaveRequestCardData["status"]) {
  const badges = {
    pending: {
      variant: "secondary" as const,
      label: "Pending",
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    approved_by_manager: {
      variant: "default" as const,
      label: "Manager Approved",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    approved_by_hr: {
      variant: "default" as const,
      label: "HR Approved",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    rejected: {
      variant: "destructive" as const,
      label: "Rejected",
      className: "bg-red-100 text-red-800 border-red-200",
    },
    cancelled: {
      variant: "secondary" as const,
      label: "Cancelled",
      className: "bg-gray-100 text-gray-800 border-gray-200",
    },
  };
  return badges[status];
}

/**
 * Calculate leave duration
 */
function calculateDuration(
  startDate: string,
  endDate: string,
  leaveType: LeaveRequestCardData["leaveType"],
  totalDays?: number,
  totalHours?: number
) {

  if (totalDays !== undefined) {
    return {
      value: totalDays,
      unit: totalDays === 1 ? "day" : "days",
      display: `${totalDays} ${totalDays === 1 ? "day" : "days"}`,
    };
  }

  // Fallback: calculate from dates
  const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  return {
    value: days,
    unit: days === 1 ? "day" : "days",
    display: `${days} ${days === 1 ? "day" : "days"}`,
  };
}

/**
 * Determine which actions to show based on status and user role
 */
function getAvailableActions(
  request: LeaveRequestCardData,
  userRole?: LeaveRequestCardProps["userRole"],
  showActions: boolean = true
): {
  canApprove: boolean;
  canReject: boolean;
  approvalLevel?: "manager" | "hr";
} {
  if (!showActions || !userRole) {
    return { canApprove: false, canReject: false };
  }

  // Account managers can approve pending requests
  if (userRole === "account_manager" && request.status === "pending") {
    return { canApprove: true, canReject: true, approvalLevel: "manager" };
  }

  // HR/Admin can approve manager-approved requests
  if (
    (userRole === "hr" || userRole === "admin") &&
    request.status === "approved_by_manager"
  ) {
    return { canApprove: true, canReject: true, approvalLevel: "hr" };
  }

  return { canApprove: false, canReject: false };
}

/**
 * LeaveRequestCard component - Displays individual leave request with all details
 */
export function LeaveRequestCard({
  request,
  userRole,
  onApprove,
  onReject,
  onViewDetails,
  showActions = true,
  className,
  clickable = true,
  showCheckbox = false,
  isSelected = false,
  onSelectionToggle,
}: LeaveRequestCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const leaveTypeColor = getLeaveTypeColor(request.leaveType);
  const statusBadge = getStatusBadge(request.status);
  const duration = calculateDuration(
    request.startDate,
    request.endDate,
    request.leaveType,
    request.totalDays,
    request.totalHours
  );
  const isOverdue = isLeaveRequestOverdue(request.startDate);
  const actions = getAvailableActions(request, userRole, showActions);

  const handleCardClick = () => {
    if (clickable && onViewDetails) {
      onViewDetails(request.id);
    }
  };

  const handleApproveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actions.canApprove && actions.approvalLevel && onApprove) {
      onApprove(request.id, actions.approvalLevel);
    }
  };

  const handleRejectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actions.canReject && onReject) {
      onReject(request.id);
    }
  };

  const handleViewDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewDetails) {
      onViewDetails(request.id);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (onSelectionToggle) {
      onSelectionToggle(request.id);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        clickable && "cursor-pointer hover:shadow-lg hover:border-primary/50",
        isOverdue && "border-l-4 border-l-red-500",
        isSelected && "ring-2 ring-primary border-primary",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <CardContent className="p-5">
        <VStack gap="4">
          {/* Header: Employee Info and Status */}
          <HStack justify="between" align="start" gap="4">
            <HStack gap="3" align="center" className="flex-1 min-w-0">
              {/* Checkbox */}
              {showCheckbox && (
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleCheckboxChange}
                  />
                </div>
              )}

              {/* Avatar */}
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {getInitials(request.employeeName)}
                </AvatarFallback>
              </Avatar>

              {/* Employee Info */}
              <VStack gap="0" align="start" className="flex-1 min-w-0">
                <H4 className="truncate w-full">{request.employeeName}</H4>
                <Caption className="text-muted-foreground">
                  {request.employeeId}
                  {request.department && ` • ${request.department}`}
                </Caption>
              </VStack>
            </HStack>

            {/* Status Badge */}
            <Badge
              variant={statusBadge.variant}
              className={cn("shrink-0", statusBadge.className)}
            >
              {statusBadge.label}
            </Badge>
          </HStack>

          {/* Leave Type Badge */}
          <div>
            <Badge
              variant="outline"
              className={cn("text-sm font-semibold", leaveTypeColor.badge)}
            >
              {request.leaveType}
            </Badge>
          </div>

          {/* Date Range and Duration */}
          <HStack gap="4" align="center" className="flex-wrap">
            <HStack gap="2" align="center">
              <Icon
                name="CalendarBlank"
                size={IconSizes.sm}
                className="text-muted-foreground"
              />
              <BodySmall className="font-medium">
                {formatDateRange(
                  request.startDate,
                  request.endDate,
                  request.selectedDates
                )}
              </BodySmall>
            </HStack>

            <HStack gap="2" align="center">
              <Icon
                name="Clock"
                size={IconSizes.sm}
                className="text-muted-foreground"
              />
              <BodySmall className="font-semibold text-emerald-600">
                {duration.display}
              </BodySmall>
            </HStack>

            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                Overdue
              </Badge>
            )}
          </HStack>

          {/* Leave Balance (if applicable) */}
          {request.availableCredits !== undefined && (
            <div
              className={cn(
                "rounded-md border p-3",
                request.leaveType === "SIL" &&
                  request.availableCredits !== undefined &&
                  (request.totalDays || 0) > (request.availableCredits || 0)
                  ? "border-red-200 bg-red-50"
                  : "border-emerald-200 bg-emerald-50"
              )}
            >
              <HStack gap="2" align="center">
                <Icon
                  name="Info"
                  size={IconSizes.sm}
                  className={
                    request.leaveType === "SIL" &&
                    request.availableCredits !== undefined &&
                    (request.totalDays || 0) > (request.availableCredits || 0)
                      ? "text-red-600"
                      : "text-emerald-600"
                  }
                />
                <BodySmall
                  className={
                    request.leaveType === "SIL" &&
                    request.availableCredits !== undefined &&
                    (request.totalDays || 0) > (request.availableCredits || 0)
                      ? "text-red-700 font-semibold"
                      : "text-emerald-700"
                  }
                >
                  {request.leaveType === "SIL" &&
                    request.availableCredits !== undefined && (
                      <>
                        Available SIL Credits: {request.availableCredits} (Allotted: 10)
                        {(request.totalDays || 0) >
                          (request.availableCredits || 0) && (
                          <span className="ml-1">(Insufficient)</span>
                        )}
                      </>
                    )}
                </BodySmall>
              </HStack>
            </div>
          )}

          {/* Location/Address */}
          {(request.location || request.address) && (
            <HStack gap="2" align="start">
              <Icon
                name="MapPin"
                size={IconSizes.sm}
                className="text-muted-foreground mt-0.5 shrink-0"
              />
              <BodySmall className="text-muted-foreground">
                {request.location}
                {request.location && request.address && " • "}
                {request.address}
              </BodySmall>
            </HStack>
          )}

          {/* Reason (on hover or always if short) */}
          {request.reason && (
            <div
              className={cn(
                "transition-all duration-200",
                isHovered || request.reason.length < 100
                  ? "opacity-100 max-h-32"
                  : "opacity-0 max-h-0 overflow-hidden"
              )}
            >
              <BodySmall className="text-muted-foreground">
                <span className="font-semibold">Reason:</span> {request.reason}
              </BodySmall>
            </div>
          )}

          {/* Approval Information */}
          {(request.approvedByManagerName ||
            request.approvedByHRName ||
            request.rejectedBy) && (
            <VStack
              gap="1"
              align="start"
              className="text-xs text-muted-foreground"
            >
              {/* Account Manager Stage */}
              {request.approvedByManagerName && (
                <Caption>
                  Approved by Manager: {request.approvedByManagerName}
                </Caption>
              )}
              {request.status === "rejected" &&
                request.rejectedBy &&
                !request.approvedByManagerName && (
                  <Caption className="text-red-600">
                    Rejected by Manager: {request.rejectedBy}
                    {request.rejectionReason && ` - ${request.rejectionReason}`}
                  </Caption>
                )}

              {/* HR Stage */}
              {request.status === "rejected" &&
                request.rejectedBy &&
                request.approvedByManagerName && (
                  <Caption className="text-red-600">
                    Rejected by HR: {request.rejectedBy}
                    {request.rejectionReason && ` - ${request.rejectionReason}`}
                  </Caption>
                )}
              {request.status !== "rejected" && request.approvedByHRName && (
                <Caption>Approved by HR: {request.approvedByHRName}</Caption>
              )}
            </VStack>
          )}

          {/* Action Buttons */}
          {showActions && (
            <HStack gap="2" justify="end" className="pt-2 border-t">
              {actions.canApprove && (
                <Button
                  size="sm"
                  onClick={handleApproveClick}
                  className="shrink-0"
                >
                  <Icon name="Check" size={IconSizes.sm} />
                  {actions.approvalLevel === "manager"
                    ? "Approve"
                    : "Approve (HR)"}
                </Button>
              )}

              {actions.canReject && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRejectClick}
                  className="shrink-0"
                >
                  <Icon name="X" size={IconSizes.sm} />
                  Reject
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleViewDetailsClick}
                className="shrink-0"
              >
                <Icon name="Eye" size={IconSizes.sm} />
                View Details
              </Button>
            </HStack>
          )}
        </VStack>
      </CardContent>
    </Card>
  );
}
