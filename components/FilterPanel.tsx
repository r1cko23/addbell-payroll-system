"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VStack, HStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

/**
 * Filter configuration interface
 */
export interface LeaveRequestFilterConfig {
  dateRange: {
    preset?:
      | "today"
      | "thisWeek"
      | "thisMonth"
      | "last7Days"
      | "last30Days"
      | "custom"
      | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  status: string[];
  leaveType: string[];
  employeeIds: string[];
  departments: string[];
  approvalStage: (
    | "pending"
    | "manager_approved"
    | "hr_approved"
    | "rejected"
  )[];
}

/**
 * Default filter configuration
 */
const defaultFilters: LeaveRequestFilterConfig = {
  dateRange: {
    preset: null,
    startDate: null,
    endDate: null,
  },
  status: [],
  leaveType: [],
  employeeIds: [],
  departments: [],
  approvalStage: [],
};

/**
 * Filter preset configurations
 */
export const filterPresets = {
  showPending: {
    status: ["pending"],
    approvalStage: ["pending"],
  },
  showOverdue: {
    dateRange: {
      preset: "custom",
      startDate: null,
      endDate: format(subDays(new Date(), 1), "yyyy-MM-dd"),
    },
  },
  showThisWeek: {
    dateRange: {
      preset: "thisWeek",
    },
  },
  showThisMonth: {
    dateRange: {
      preset: "thisMonth",
    },
  },
  showApproved: {
    approvalStage: ["hr_approved"],
  },
  showRejected: {
    status: ["rejected"],
    approvalStage: ["rejected"],
  },
} as const;

/**
 * Props for FilterPanel component
 */
export interface FilterPanelProps {
  /**
   * All available leave requests for filtering
   */
  leaveRequests: Array<{
    id: string;
    employeeName: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: string;
    leaveType: string;
    department?: string;
    approvedByManager?: boolean;
    approvedByHR?: boolean;
  }>;
  /**
   * Available options for filters
   */
  filterOptions?: {
    statuses?: string[];
    leaveTypes?: string[];
    employees?: Array<{ id: string; name: string }>;
    departments?: string[];
  };
  /**
   * Callback when filters change
   */
  onFilterChange?: (
    filters: LeaveRequestFilterConfig,
    filteredCount: number
  ) => void;
  /**
   * Storage key for persisting filter state (default: "leaveRequestFilters")
   */
  storageKey?: string;
  /**
   * Whether to show the filter preview count
   */
  showPreview?: boolean;
  /**
   * Custom className
   */
  className?: string;
}

/**
 * Reusable FilterPanel component for leave requests
 */
export function FilterPanel({
  leaveRequests,
  filterOptions = {},
  onFilterChange,
  storageKey = "leaveRequestFilters",
  showPreview = true,
  className,
}: FilterPanelProps) {
  // Load initial state from sessionStorage
  const loadSavedFilters = useCallback((): LeaveRequestFilterConfig => {
    if (typeof window === "undefined") return defaultFilters;

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultFilters, ...parsed };
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    }
    return defaultFilters;
  }, [storageKey]);

  const [filters, setFilters] =
    useState<LeaveRequestFilterConfig>(loadSavedFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.error("Error saving filters:", error);
    }
  }, [filters, storageKey]);

  // Extract unique values from leave requests if not provided
  const availableStatuses = useMemo(
    () =>
      filterOptions.statuses ||
      Array.from(new Set(leaveRequests.map((r) => r.status))).sort(),
    [filterOptions.statuses, leaveRequests]
  );

  const availableLeaveTypes = useMemo(
    () =>
      filterOptions.leaveTypes ||
      Array.from(new Set(leaveRequests.map((r) => r.leaveType))).sort(),
    [filterOptions.leaveTypes, leaveRequests]
  );

  const availableDepartments = useMemo(
    () =>
      filterOptions.departments ||
      Array.from(
        new Set(
          leaveRequests
            .map((r) => r.department)
            .filter((d): d is string => Boolean(d))
        )
      ).sort(),
    [filterOptions.departments, leaveRequests]
  );

  const availableEmployees = useMemo(() => {
    if (filterOptions.employees) return filterOptions.employees;

    const employeeMap = new Map<string, string>();
    leaveRequests.forEach((r) => {
      if (!employeeMap.has(r.employeeId)) {
        employeeMap.set(r.employeeId, r.employeeName);
      }
    });

    return Array.from(employeeMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filterOptions.employees, leaveRequests]);

  // Apply filters and get filtered count
  const filteredCount = useMemo(() => {
    return applyFilters(leaveRequests, filters, searchQuery).length;
  }, [leaveRequests, filters, searchQuery]);

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange?.(filters, filteredCount);
  }, [filters, filteredCount, onFilterChange]);

  // Date preset handlers
  const handleDatePreset = (
    preset:
      | "today"
      | "thisWeek"
      | "thisMonth"
      | "last7Days"
      | "last30Days"
      | "custom"
      | "none"
  ) => {
    const today = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    switch (preset) {
      case "today":
        startDate = format(today, "yyyy-MM-dd");
        endDate = format(today, "yyyy-MM-dd");
        break;
      case "thisWeek":
        startDate = format(
          startOfWeek(today, { weekStartsOn: 1 }),
          "yyyy-MM-dd"
        );
        endDate = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
        break;
      case "thisMonth":
        startDate = format(startOfMonth(today), "yyyy-MM-dd");
        endDate = format(endOfMonth(today), "yyyy-MM-dd");
        break;
      case "last7Days":
        startDate = format(subDays(today, 7), "yyyy-MM-dd");
        endDate = format(today, "yyyy-MM-dd");
        break;
      case "last30Days":
        startDate = format(subDays(today, 30), "yyyy-MM-dd");
        endDate = format(today, "yyyy-MM-dd");
        break;
      case "custom":
      case "none":
        startDate = null;
        endDate = null;
        break;
    }

    setFilters((prev) => ({
      ...prev,
      dateRange: {
        preset:
          preset === "none"
            ? null
            : (preset as
                | "today"
                | "thisWeek"
                | "thisMonth"
                | "last7Days"
                | "last30Days"
                | "custom"),
        startDate,
        endDate,
      },
    }));
  };

  // Toggle filter values
  const toggleFilter = (
    filterKey: keyof LeaveRequestFilterConfig,
    value: string
  ) => {
    setFilters((prev) => {
      const currentArray = (prev[filterKey] as string[]) || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter((v) => v !== value)
        : [...currentArray, value];

      return {
        ...prev,
        [filterKey]: newArray,
      };
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters(defaultFilters);
    setSearchQuery("");
  };

  // Apply preset filters
  const applyPreset = (presetName: keyof typeof filterPresets) => {
    const preset = filterPresets[presetName];
    setFilters((prev) => ({
      ...prev,
      ...preset,
      status:
        "status" in preset && preset.status ? [...preset.status] : prev.status,
      approvalStage:
        "approvalStage" in preset && preset.approvalStage
          ? [...preset.approvalStage]
          : prev.approvalStage,
    }));
  };

  // Filter employees by search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return availableEmployees;

    const query = searchQuery.toLowerCase();
    return availableEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.id.toLowerCase().includes(query)
    );
  }, [availableEmployees, searchQuery]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <HStack justify="between" align="center">
          <CardTitle className="text-lg">Filters</CardTitle>
          <HStack gap="2" align="center">
            {showPreview && (
              <Caption className="text-sm font-medium">
                {filteredCount} of {leaveRequests.length} requests
              </Caption>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              <Icon
                name={isExpanded ? "CaretUp" : "CaretDown"}
                size={IconSizes.sm}
              />
            </Button>
          </HStack>
        </HStack>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <VStack gap="6">
            {/* Preset Buttons */}
            <div>
              <Label className="mb-2 block">Quick Filters</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("showPending")}
                >
                  Show Pending
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("showOverdue")}
                >
                  Show Overdue
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("showThisWeek")}
                >
                  This Week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("showThisMonth")}
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("showApproved")}
                >
                  Approved
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("showRejected")}
                >
                  Rejected
                </Button>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <Label className="mb-2 block">Date Range</Label>
              <Select
                value={filters.dateRange.preset || "none"}
                onValueChange={handleDatePreset}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No filter</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="last7Days">Last 7 Days</SelectItem>
                  <SelectItem value="last30Days">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {filters.dateRange.preset === "custom" && (
                <HStack gap="2" className="mt-2">
                  <div className="flex-1">
                    <Label htmlFor="start-date" className="text-xs">
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={filters.dateRange.startDate || ""}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: {
                            ...prev.dateRange,
                            startDate: e.target.value || null,
                          },
                        }))
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="end-date" className="text-xs">
                      End Date
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={filters.dateRange.endDate || ""}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: {
                            ...prev.dateRange,
                            endDate: e.target.value || null,
                          },
                        }))
                      }
                      className="h-9"
                    />
                  </div>
                </HStack>
              )}
            </div>

            {/* Status Filter */}
            {availableStatuses.length > 0 && (
              <div>
                <Label className="mb-2 block">Status</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableStatuses.map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.status.includes(status)}
                        onCheckedChange={() => toggleFilter("status", status)}
                      />
                      <span className="text-sm capitalize">
                        {status.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Leave Type Filter */}
            {availableLeaveTypes.length > 0 && (
              <div>
                <Label className="mb-2 block">Leave Type</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableLeaveTypes.map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.leaveType.includes(type)}
                        onCheckedChange={() => toggleFilter("leaveType", type)}
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Stage Filter */}
            <div>
              <Label className="mb-2 block">Approval Stage</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { value: "pending", label: "Pending" },
                  { value: "manager_approved", label: "Manager Approved" },
                  { value: "hr_approved", label: "HR Approved" },
                  { value: "rejected", label: "Rejected" },
                ].map((stage) => (
                  <label
                    key={stage.value}
                    className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.approvalStage.includes(
                        stage.value as any
                      )}
                      onCheckedChange={() =>
                        toggleFilter("approvalStage", stage.value)
                      }
                    />
                    <span className="text-sm">{stage.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Employee Filter */}
            {availableEmployees.length > 0 && (
              <div>
                <Label className="mb-2 block">Employee</Label>
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                  {filteredEmployees.length === 0 ? (
                    <BodySmall className="text-center py-2 text-muted-foreground">
                      No employees found
                    </BodySmall>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.employeeIds.includes(emp.id)}
                          onCheckedChange={() =>
                            toggleFilter("employeeIds", emp.id)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {emp.name}
                          </div>
                          <Caption className="truncate">{emp.id}</Caption>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Department Filter */}
            {availableDepartments.length > 0 && (
              <div>
                <Label className="mb-2 block">Department</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableDepartments.map((dept) => (
                    <label
                      key={dept}
                      className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.departments.includes(dept)}
                        onCheckedChange={() =>
                          toggleFilter("departments", dept)
                        }
                      />
                      <span className="text-sm">{dept}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Clear All Button */}
            <Button
              variant="outline"
              onClick={clearAllFilters}
              className="w-full"
            >
              <Icon name="X" size={IconSizes.sm} />
              Clear All Filters
            </Button>
          </VStack>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Apply filters to leave requests
 */
export function applyFilters(
  leaveRequests: Array<{
    id: string;
    employeeName: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: string;
    leaveType: string;
    department?: string;
    approvedByManager?: boolean;
    approvedByHR?: boolean;
  }>,
  filters: LeaveRequestFilterConfig,
  searchQuery?: string
): Array<(typeof leaveRequests)[0]> {
  let filtered = [...leaveRequests];

  // Date range filter
  if (filters.dateRange.startDate || filters.dateRange.endDate) {
    filtered = filtered.filter((req) => {
      const startDate = filters.dateRange.startDate;
      const endDate = filters.dateRange.endDate;
      const reqStart = new Date(req.startDate);
      const reqEnd = new Date(req.endDate);

      if (startDate && reqEnd < new Date(startDate)) return false;
      if (endDate && reqStart > new Date(endDate)) return false;
      return true;
    });
  }

  // Status filter
  if (filters.status.length > 0) {
    filtered = filtered.filter((req) => filters.status.includes(req.status));
  }

  // Leave type filter
  if (filters.leaveType.length > 0) {
    filtered = filtered.filter((req) =>
      filters.leaveType.includes(req.leaveType)
    );
  }

  // Employee filter
  if (filters.employeeIds.length > 0) {
    filtered = filtered.filter((req) =>
      filters.employeeIds.includes(req.employeeId)
    );
  }

  // Department filter
  if (filters.departments.length > 0) {
    filtered = filtered.filter((req) => {
      if (!req.department) return false;
      return filters.departments.includes(req.department);
    });
  }

  // Approval stage filter
  if (filters.approvalStage.length > 0) {
    filtered = filtered.filter((req) => {
      if (filters.approvalStage.includes("pending")) {
        if (req.status === "pending") return true;
      }
      if (filters.approvalStage.includes("manager_approved")) {
        if (req.approvedByManager && !req.approvedByHR) return true;
      }
      if (filters.approvalStage.includes("hr_approved")) {
        if (req.approvedByHR) return true;
      }
      if (filters.approvalStage.includes("rejected")) {
        if (req.status === "rejected") return true;
      }
      return false;
    });
  }

  // Search query filter (if provided)
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (req) =>
        req.employeeName.toLowerCase().includes(query) ||
        req.employeeId.toLowerCase().includes(query) ||
        req.leaveType.toLowerCase().includes(query) ||
        req.department?.toLowerCase().includes(query)
    );
  }

  return filtered;
}