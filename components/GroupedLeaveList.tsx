"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { VStack, HStack } from "@/components/ui/stack";
import { BodySmall, Caption, H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  LeaveRequestCard,
  type LeaveRequestCardData,
} from "./LeaveRequestCard";
import { type NestedGroupedLeaveRequests } from "@/utils/leave-requests";
import { cn } from "@/lib/utils";
import { parseISO } from "date-fns";

/**
 * Props for GroupedLeaveList component
 */
export interface GroupedLeaveListProps {
  /**
   * Grouped leave request data
   */
  groupedData: NestedGroupedLeaveRequests;
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
   * Threshold for enabling virtual scrolling (default: 20)
   */
  virtualScrollThreshold?: number;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Whether sections are expanded by default
   */
  defaultExpanded?: boolean;
}

/**
 * Calculate summary stats for a group
 */
function calculateGroupStats(items: LeaveRequestCardData[]) {
  let totalDays = 0;
  let totalHours = 0;

  items.forEach((item) => {
    if (item.totalDays) {
      totalDays += item.totalDays;
    } else {
      // Fallback: calculate from dates
      const days =
        Math.abs(
          parseISO(item.endDate).getTime() - parseISO(item.startDate).getTime()
        ) /
        (1000 * 60 * 60 * 24);
      totalDays += Math.ceil(days) + 1;
    }
  });

  return { totalDays, totalHours };
}

/**
 * Format summary stats for display
 */
function formatSummaryStats(stats: { totalDays: number; totalHours: number }) {
  const parts: string[] = [];

  if (stats.totalDays > 0) {
    parts.push(`${stats.totalDays} ${stats.totalDays === 1 ? "day" : "days"}`);
  }

  if (stats.totalHours > 0) {
    parts.push(
      `${stats.totalHours.toFixed(1)} ${
        stats.totalHours === 1 ? "hour" : "hours"
      }`
    );
  }

  return parts.join(" • ") || "0 days";
}

/**
 * Simple virtual scrolling hook for large lists
 */
function useVirtualScroll<T>(
  items: T[],
  itemHeight: number = 200,
  containerHeight: number = 600,
  threshold: number = 20
) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = items.length > threshold;

  const visibleRange = useMemo(() => {
    if (!shouldVirtualize) {
      return { start: 0, end: items.length };
    }

    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + 2,
      items.length
    );

    return { start: Math.max(0, start - 1), end };
  }, [scrollTop, itemHeight, containerHeight, items.length, shouldVirtualize]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldVirtualize) return;

    const handleScrollEvent = (e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollTop(target.scrollTop);
    };

    container.addEventListener("scroll", handleScrollEvent);
    return () => container.removeEventListener("scroll", handleScrollEvent);
  }, [shouldVirtualize]);

  return {
    containerRef,
    visibleRange,
    shouldVirtualize,
    handleScroll,
    totalHeight: shouldVirtualize ? items.length * itemHeight : "auto",
  };
}

/**
 * GroupedLeaveList component - Renders grouped leave requests with collapsible sections
 */
export function GroupedLeaveList({
  groupedData,
  userRole,
  onApprove,
  onReject,
  onViewDetails,
  showActions = true,
  virtualScrollThreshold = 20,
  className,
  defaultExpanded = true,
}: GroupedLeaveListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (defaultExpanded) {
      return new Set(groupedData.groups.map((g) => g.key));
    }
    return new Set();
  });

  const scrollPositions = useRef<Map<string, number>>(new Map());
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Toggle group expansion
  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(groupKey)) {
        // Save scroll position before collapsing
        const groupElement = groupRefs.current.get(groupKey);
        if (groupElement) {
          scrollPositions.current.set(groupKey, groupElement.scrollTop || 0);
        }
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
        // Restore scroll position after expanding
        setTimeout(() => {
          const groupElement = groupRefs.current.get(groupKey);
          const savedPosition = scrollPositions.current.get(groupKey);
          if (groupElement && savedPosition !== undefined) {
            groupElement.scrollTop = savedPosition;
          }
        }, 0);
      }

      return newSet;
    });
  }, []);

  // Expand/collapse all
  const expandAll = useCallback(() => {
    setExpandedGroups(new Set(groupedData.groups.map((g) => g.key)));
  }, [groupedData.groups]);

  const collapseAll = useCallback(() => {
    // Save all scroll positions
    groupRefs.current.forEach((element, key) => {
      scrollPositions.current.set(key, element.scrollTop || 0);
    });
    setExpandedGroups(new Set());
  }, []);

  // Calculate if any groups are expanded
  const hasExpandedGroups = expandedGroups.size > 0;
  const allExpanded = expandedGroups.size === groupedData.groups.length;

  return (
    <VStack gap="4" className={cn("w-full", className)}>
      {/* Header Actions */}
      {groupedData.groups.length > 0 && (
        <HStack
          justify="between"
          align="center"
          className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-2"
        >
          <H3>
            Leave Requests (
            {groupedData.groups.reduce((sum, g) => sum + g.count, 0)})
          </H3>
          <HStack gap="2">
            <Button
              variant="outline"
              size="sm"
              onClick={allExpanded ? collapseAll : expandAll}
            >
              <Icon
                name={allExpanded ? "CaretUp" : "CaretDown"}
                size={IconSizes.sm}
              />
              {allExpanded ? "Collapse All" : "Expand All"}
            </Button>
          </HStack>
        </HStack>
      )}

      {/* Groups */}
      {groupedData.groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Icon
            name="CalendarBlank"
            size={IconSizes.xl}
            className="text-muted-foreground mb-4"
          />
          <BodySmall className="text-muted-foreground">
            No leave requests found
          </BodySmall>
        </div>
      ) : (
        <VStack gap="0" className="w-full">
          {groupedData.groups.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            const stats = calculateGroupStats(
              group.items as LeaveRequestCardData[]
            );
            const summary = formatSummaryStats(stats);

            return (
              <div key={group.key} className="border-b last:border-b-0">
                {/* Sticky Section Header */}
                <div
                  className={cn(
                    "sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b transition-colors",
                    isExpanded && "bg-muted/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    )}
                    aria-expanded={isExpanded}
                  >
                    <HStack gap="3" align="center" className="flex-1 min-w-0">
                      <Icon
                        name={isExpanded ? "CaretDown" : "CaretRight"}
                        size={IconSizes.md}
                        className="text-muted-foreground shrink-0"
                      />
                      <H3 className="text-lg font-semibold truncate">
                        {group.label}
                      </H3>
                      <Badge variant="secondary" className="shrink-0">
                        {group.count}
                      </Badge>
                      <Caption className="text-muted-foreground hidden sm:inline shrink-0">
                        {summary}
                      </Caption>
                    </HStack>
                  </button>
                </div>

                {/* Section Content */}
                {isExpanded && (
                  <GroupSectionContent
                    groupKey={group.key}
                    items={group.items as LeaveRequestCardData[]}
                    userRole={userRole}
                    onApprove={onApprove}
                    onReject={onReject}
                    onViewDetails={onViewDetails}
                    showActions={showActions}
                    virtualScrollThreshold={virtualScrollThreshold}
                    groupRef={(el) => {
                      if (el) {
                        groupRefs.current.set(group.key, el);
                      } else {
                        groupRefs.current.delete(group.key);
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}

/**
 * Group section content component with virtual scrolling support
 */
interface GroupSectionContentProps {
  groupKey: string;
  items: LeaveRequestCardData[];
  userRole?: "account_manager" | "hr" | "admin" | "employee";
  onApprove?: (requestId: string, level: "manager" | "hr") => void;
  onReject?: (requestId: string) => void;
  onViewDetails?: (requestId: string) => void;
  showActions?: boolean;
  virtualScrollThreshold?: number;
  groupRef?: (el: HTMLDivElement | null) => void;
}

function GroupSectionContent({
  groupKey,
  items,
  userRole,
  onApprove,
  onReject,
  onViewDetails,
  showActions,
  virtualScrollThreshold = 20,
  groupRef,
}: GroupSectionContentProps) {
  const {
    containerRef,
    visibleRange,
    shouldVirtualize,
    handleScroll,
    totalHeight,
  } = useVirtualScroll(items, 220, 600, virtualScrollThreshold);

  const visibleItems = useMemo(() => {
    if (!shouldVirtualize) {
      return items;
    }
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange, shouldVirtualize]);

  const offsetTop = shouldVirtualize ? visibleRange.start * 220 : 0;

  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <Icon
          name="CalendarBlank"
          size={IconSizes.lg}
          className="text-muted-foreground mx-auto mb-2"
        />
        <BodySmall className="text-muted-foreground">
          No requests in this group
        </BodySmall>
      </div>
    );
  }

  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      // Type assertion to allow assignment to ref.current
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
        el;
      groupRef?.(el);
    },
    [groupRef, containerRef]
  );

  return (
    <div
      ref={mergedRef}
      onScroll={handleScroll}
      className={cn("overflow-y-auto", shouldVirtualize && "relative")}
      style={
        shouldVirtualize
          ? {
              height: "600px",
              maxHeight: "70vh",
            }
          : undefined
      }
    >
      <div
        style={
          shouldVirtualize
            ? {
                height: typeof totalHeight === "number" ? totalHeight : "auto",
                position: "relative",
              }
            : undefined
        }
      >
        <div
          style={
            shouldVirtualize
              ? {
                  transform: `translateY(${offsetTop}px)`,
                  position: "relative",
                }
              : undefined
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {visibleItems.map((item) => (
              <LeaveRequestCard
                key={item.id}
                request={item}
                userRole={userRole}
                onApprove={onApprove}
                onReject={onReject}
                onViewDetails={onViewDetails}
                showActions={showActions}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}