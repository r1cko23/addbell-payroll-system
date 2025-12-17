"use client";

import React from "react";
import { format, parseISO, isValid } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VStack, HStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

/**
 * Approval workflow stage
 */
export type WorkflowStage =
  | "pending"
  | "manager_review"
  | "hr_review"
  | "approved"
  | "rejected"
  | "cancelled";

/**
 * Stage status
 */
export type StageStatus = "completed" | "in_progress" | "pending" | "rejected";

/**
 * Approval information interface
 */
export interface ApprovalInfo {
  /**
   * Approver user ID
   */
  approverId?: string | null;
  /**
   * Approver name (display name)
   */
  approverName?: string | null;
  /**
   * Approval timestamp (ISO string)
   */
  approvedAt?: string | null;
  /**
   * Notes/comments from approver
   */
  notes?: string | null;
}

/**
 * Props for ApprovalWorkflowIndicator component
 */
export interface ApprovalWorkflowIndicatorProps {
  /**
   * Current status of the leave request
   */
  status:
    | "pending"
    | "approved_by_manager"
    | "approved_by_hr"
    | "rejected"
    | "cancelled";
  /**
   * Manager approval information
   */
  managerApproval?: ApprovalInfo;
  /**
   * HR approval information
   */
  hrApproval?: ApprovalInfo;
  /**
   * Rejection information
   */
  rejection?: {
    rejectedBy?: string | null;
    rejectedAt?: string | null;
    rejectionReason?: string | null;
  };
  /**
   * Request creation timestamp
   */
  createdAt?: string | null;
  /**
   * Whether to show detailed information (notes, timestamps)
   */
  showDetails?: boolean;
  /**
   * Custom className
   */
  className?: string;
}

/**
 * Workflow stage configuration
 */
interface StageConfig {
  key: WorkflowStage;
  label: string;
  icon: string;
  description: string;
}

const STAGES: StageConfig[] = [
  {
    key: "pending",
    label: "Pending",
    icon: "Hourglass",
    description: "Awaiting manager review",
  },
  {
    key: "manager_review",
    label: "Manager Review",
    icon: "UsersThree",
    description: "Under manager review",
  },
  {
    key: "hr_review",
    label: "HR Review",
    icon: "CheckCircle",
    description: "Under HR review",
  },
  {
    key: "approved",
    label: "Approved",
    icon: "CheckCircle",
    description: "Fully approved",
  },
];

/**
 * Get stage status based on current request status
 */
function getStageStatus(
  stage: WorkflowStage,
  currentStatus: ApprovalWorkflowIndicatorProps["status"],
  managerApproval?: ApprovalInfo,
  hrApproval?: ApprovalInfo
): StageStatus {
  if (currentStatus === "rejected" || currentStatus === "cancelled") {
    if (stage === "pending" || stage === "manager_review") {
      return currentStatus === "rejected" ? "rejected" : "pending";
    }
    return "pending";
  }

  switch (stage) {
    case "pending":
      return currentStatus === "pending" ? "in_progress" : "completed";
    case "manager_review":
      if (currentStatus === "pending") return "pending";
      if (managerApproval?.approvedAt) return "completed";
      return currentStatus === "approved_by_manager" ||
        currentStatus === "approved_by_hr"
        ? "completed"
        : "in_progress";
    case "hr_review":
      if (
        currentStatus === "pending" ||
        currentStatus === "approved_by_manager"
      )
        return currentStatus === "approved_by_manager"
          ? "in_progress"
          : "pending";
      if (hrApproval?.approvedAt) return "completed";
      return currentStatus === "approved_by_hr" ? "completed" : "pending";
    case "approved":
      return currentStatus === "approved_by_hr" ? "completed" : "pending";
    default:
      return "pending";
  }
}

/**
 * Get color classes for stage status
 */
function getStageColorClasses(
  status: StageStatus,
  isRejected: boolean = false
) {
  if (isRejected && status === "rejected") {
    return {
      circle: "bg-destructive text-destructive-foreground border-destructive",
      line: "bg-destructive",
      text: "text-destructive",
      badge: "bg-destructive/10 text-destructive border-destructive/20",
    };
  }

  switch (status) {
    case "completed":
      return {
        circle: "bg-primary text-primary-foreground border-primary",
        line: "bg-primary",
        text: "text-foreground",
        badge: "bg-primary/10 text-primary border-primary/20",
      };
    case "in_progress":
      return {
        circle:
          "bg-primary/20 text-primary border-primary ring-2 ring-primary ring-offset-2",
        line: "bg-muted",
        text: "text-primary font-medium",
        badge: "bg-primary/10 text-primary border-primary/20",
      };
    case "pending":
      return {
        circle: "bg-muted text-muted-foreground border-muted",
        line: "bg-muted",
        text: "text-muted-foreground",
        badge: "bg-muted text-muted-foreground border-muted",
      };
    case "rejected":
      return {
        circle: "bg-destructive text-destructive-foreground border-destructive",
        line: "bg-destructive",
        text: "text-destructive",
        badge: "bg-destructive/10 text-destructive border-destructive/20",
      };
    default:
      return {
        circle: "bg-muted text-muted-foreground border-muted",
        line: "bg-muted",
        text: "text-muted-foreground",
        badge: "bg-muted text-muted-foreground border-muted",
      };
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  try {
    const date = parseISO(timestamp);
    if (!isValid(date)) return null;
    return format(date, "MMM dd, yyyy 'at' h:mm a");
  } catch {
    return null;
  }
}

/**
 * ApprovalWorkflowIndicator component
 * Displays a linear progress indicator showing the approval workflow stages
 */
export function ApprovalWorkflowIndicator({
  status,
  managerApproval,
  hrApproval,
  rejection,
  createdAt,
  showDetails = true,
  className,
}: ApprovalWorkflowIndicatorProps) {
  const isRejected = status === "rejected";
  const isCancelled = status === "cancelled";

  // Determine which stages to show
  const activeStages = isRejected
    ? STAGES.slice(0, 2) // Show up to manager review if rejected
    : STAGES;

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <VStack gap="4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <HStack gap="2" align="center">
              <Icon name="ArrowRight" size={IconSizes.md} />
              <BodySmall className="font-semibold">Approval Workflow</BodySmall>
            </HStack>
            <Badge
              variant="outline"
              className={cn(
                isRejected &&
                  "bg-destructive/10 text-destructive border-destructive/20",
                isCancelled && "bg-muted text-muted-foreground",
                status === "approved_by_hr" &&
                  "bg-primary/10 text-primary border-primary/20"
              )}
            >
              {status === "approved_by_hr"
                ? "Approved"
                : status === "approved_by_manager"
                ? "Manager Approved"
                : status === "rejected"
                ? "Rejected"
                : status === "cancelled"
                ? "Cancelled"
                : "In Progress"}
            </Badge>
          </div>

          {/* Timeline */}
          <div className="relative">
            {activeStages.map((stage, index) => {
              const stageStatus = getStageStatus(
                stage.key,
                status,
                managerApproval,
                hrApproval
              );
              const colors = getStageColorClasses(
                stageStatus,
                isRejected && stage.key === "manager_review"
              );
              const isLast = index === activeStages.length - 1;

              // Get approval info for this stage
              let approvalInfo: ApprovalInfo | undefined;
              let timestamp: string | null = null;
              let approverName: string | null = null;
              let notes: string | null = null;

              if (stage.key === "manager_review" && managerApproval) {
                approvalInfo = managerApproval;
                timestamp = managerApproval.approvedAt || null;
                approverName = managerApproval.approverName || null;
                notes = managerApproval.notes || null;
              } else if (stage.key === "hr_review" && hrApproval) {
                approvalInfo = hrApproval;
                timestamp = hrApproval.approvedAt || null;
                approverName = hrApproval.approverName || null;
                notes = hrApproval.notes || null;
              } else if (stage.key === "pending" && createdAt) {
                timestamp = createdAt;
              }

              const formattedTimestamp = formatTimestamp(timestamp);

              return (
                <div key={stage.key} className="relative">
                  <div className="flex items-start gap-4">
                    {/* Circle Indicator */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                          colors.circle
                        )}
                      >
                        <Icon
                          name={
                            stage.icon as
                              | "Hourglass"
                              | "UsersThree"
                              | "CheckCircle"
                              | "Clock"
                          }
                          size={IconSizes.sm}
                          className={cn(
                            stageStatus === "completed" &&
                              "text-primary-foreground",
                            stageStatus === "in_progress" && "text-primary",
                            stageStatus === "pending" &&
                              "text-muted-foreground",
                            stageStatus === "rejected" &&
                              "text-destructive-foreground"
                          )}
                        />
                      </div>
                      {/* Connecting Line */}
                      {!isLast && (
                        <div
                          className={cn(
                            "absolute top-10 h-full w-0.5",
                            stageStatus === "completed"
                              ? colors.line
                              : "bg-muted"
                          )}
                          style={{ height: "calc(100% + 1rem)" }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <HStack gap="2" align="center" className="mb-1">
                            <BodySmall
                              className={cn("font-semibold", colors.text)}
                            >
                              {stage.label}
                            </BodySmall>
                            {stageStatus === "in_progress" && (
                              <Badge
                                variant="outline"
                                className="bg-primary/10 text-primary border-primary/20 text-xs"
                              >
                                Current
                              </Badge>
                            )}
                            {stageStatus === "completed" && (
                              <Badge
                                variant="outline"
                                className="bg-primary/10 text-primary border-primary/20 text-xs"
                              >
                                Completed
                              </Badge>
                            )}
                            {stageStatus === "rejected" && (
                              <Badge
                                variant="outline"
                                className="bg-destructive/10 text-destructive border-destructive/20 text-xs"
                              >
                                Rejected
                              </Badge>
                            )}
                          </HStack>
                          <Caption className={cn("text-xs", colors.text)}>
                            {stage.description}
                          </Caption>

                          {/* Approval Details */}
                          {showDetails && (
                            <VStack gap="2" className="mt-3">
                              {approverName && (
                                <HStack gap="2" align="center">
                                  <Icon
                                    name="User"
                                    size={IconSizes.xs}
                                    className="text-muted-foreground"
                                  />
                                  <Caption className="text-xs">
                                    Approved by:{" "}
                                    <span className="font-medium">
                                      {approverName}
                                    </span>
                                  </Caption>
                                </HStack>
                              )}
                              {formattedTimestamp && (
                                <HStack gap="2" align="center">
                                  <Icon
                                    name="Clock"
                                    size={IconSizes.xs}
                                    className="text-muted-foreground"
                                  />
                                  <Caption className="text-xs">
                                    {formattedTimestamp}
                                  </Caption>
                                </HStack>
                              )}
                              {notes && (
                                <div className="mt-2 p-2 bg-muted rounded-md border">
                                  <HStack gap="2" align="start">
                                    <Icon
                                      name="ChatCircleDots"
                                      size={IconSizes.xs}
                                      className="text-muted-foreground mt-0.5"
                                    />
                                    <Caption className="text-xs flex-1 whitespace-pre-wrap">
                                      {notes}
                                    </Caption>
                                  </HStack>
                                </div>
                              )}
                            </VStack>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rejection Details */}
          {isRejected && rejection && showDetails && (
            <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <HStack gap="2" align="start">
                <Icon
                  name="XCircle"
                  size={IconSizes.sm}
                  className="text-destructive mt-0.5"
                />
                <VStack gap="1" align="start" className="flex-1">
                  <BodySmall className="font-semibold text-destructive">
                    Request Rejected
                  </BodySmall>
                  {rejection.rejectionReason && (
                    <Caption className="text-xs text-destructive/80">
                      {rejection.rejectionReason}
                    </Caption>
                  )}
                  {rejection.rejectedAt && (
                    <Caption className="text-xs text-destructive/60">
                      {formatTimestamp(rejection.rejectedAt)}
                    </Caption>
                  )}
                </VStack>
              </HStack>
            </div>
          )}

          {/* Cancelled Status */}
          {isCancelled && showDetails && (
            <div className="mt-2 p-3 bg-muted border rounded-md">
              <HStack gap="2" align="start">
                <Icon
                  name="XCircle"
                  size={IconSizes.sm}
                  className="text-muted-foreground mt-0.5"
                />
                <VStack gap="1" align="start" className="flex-1">
                  <BodySmall className="font-semibold text-muted-foreground">
                    Request Cancelled
                  </BodySmall>
                  <Caption className="text-xs text-muted-foreground">
                    This request has been cancelled.
                  </Caption>
                </VStack>
              </HStack>
            </div>
          )}
        </VStack>
      </CardContent>
    </Card>
  );
}
