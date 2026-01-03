"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  isSameDay,
  isSameMonth,
  eachDayOfInterval,
  isWithinInterval,
  isValid,
  isAfter,
  isBefore,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VStack, HStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Date range result interface
 */
export interface DateRange {
  startDate: string | null; // ISO date string (yyyy-MM-dd)
  endDate: string | null; // ISO date string (yyyy-MM-dd)
}

/**
 * Leave request interface for calendar display
 */
export interface LeaveRequestForCalendar {
  id: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  selectedDates?: string[] | null; // Array of ISO date strings for non-consecutive dates
  leaveType: string;
  status?: string;
  employeeName?: string;
}

/**
 * Props for DateRangePresets component
 */
export interface DateRangePresetsProps {
  /**
   * Callback when date range changes
   */
  onChange?: (range: DateRange) => void;
  /**
   * Initial date range
   */
  initialRange?: DateRange;
  /**
   * Leave requests to display on calendar
   */
  leaveRequests?: LeaveRequestForCalendar[];
  /**
   * Whether to show the calendar view
   */
  showCalendar?: boolean;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Whether to allow relative date search
   */
  allowRelativeSearch?: boolean;
}

/**
 * Preset type
 */
type PresetType =
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "thisMonth"
  | "last7Days"
  | "last30Days"
  | "custom";

/**
 * Parse relative date strings like "last 3 days", "next 5 days", etc.
 */
function parseRelativeDate(query: string): DateRange | null {
  const normalized = query.toLowerCase().trim();

  // Pattern: "last X days" or "past X days"
  const lastDaysMatch = normalized.match(/(?:last|past)\s+(\d+)\s+days?/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[1], 10);
    if (days > 0 && days <= 365) {
      const today = new Date();
      return {
        startDate: format(subDays(today, days - 1), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      };
    }
  }

  // Pattern: "next X days" or "upcoming X days"
  const nextDaysMatch = normalized.match(/(?:next|upcoming)\s+(\d+)\s+days?/);
  if (nextDaysMatch) {
    const days = parseInt(nextDaysMatch[1], 10);
    if (days > 0 && days <= 365) {
      const today = new Date();
      return {
        startDate: format(today, "yyyy-MM-dd"),
        endDate: format(addDays(today, days - 1), "yyyy-MM-dd"),
      };
    }
  }

  // Pattern: "last week", "last month"
  if (normalized === "last week") {
    const today = new Date();
    const lastWeekStart = subDays(today, 7);
    return {
      startDate: format(
        startOfWeek(lastWeekStart, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      ),
      endDate: format(
        endOfWeek(lastWeekStart, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      ),
    };
  }

  if (normalized === "last month") {
    const lastMonth = subDays(new Date(), 30);
    return {
      startDate: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
      endDate: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
    };
  }

  return null;
}

/**
 * Get preset date range
 */
function getPresetRange(preset: PresetType): DateRange {
  const today = new Date();

  switch (preset) {
    case "today":
      const todayStr = format(today, "yyyy-MM-dd");
      return { startDate: todayStr, endDate: todayStr };

    case "tomorrow":
      const tomorrow = addDays(today, 1);
      const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
      return { startDate: tomorrowStr, endDate: tomorrowStr };

    case "thisWeek":
      return {
        startDate: format(
          startOfWeek(today, { weekStartsOn: 1 }),
          "yyyy-MM-dd"
        ),
        endDate: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };

    case "thisMonth":
      return {
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate: format(endOfMonth(today), "yyyy-MM-dd"),
      };

    case "last7Days":
      return {
        startDate: format(subDays(today, 6), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      };

    case "last30Days":
      return {
        startDate: format(subDays(today, 29), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      };

    case "custom":
    default:
      return { startDate: null, endDate: null };
  }
}

/**
 * Format date range for display
 */
function formatDateRange(range: DateRange): string {
  if (!range.startDate || !range.endDate) {
    return "No date range selected";
  }

  try {
    const start = parseISO(range.startDate);
    const end = parseISO(range.endDate);

    if (isSameDay(start, end)) {
      return format(start, "MMM dd, yyyy");
    }

    // Same month and year
    if (
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear()
    ) {
      return `${format(start, "MMM dd")} - ${format(end, "dd, yyyy")}`;
    }

    // Same year
    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, "MMM dd")} - ${format(end, "MMM dd, yyyy")}`;
    }

    // Different years
    return `${format(start, "MMM dd, yyyy")} - ${format(end, "MMM dd, yyyy")}`;
  } catch {
    return "Invalid date range";
  }
}

/**
 * Check if a date is within the selected range
 */
function isDateInRange(date: Date, range: DateRange): boolean {
  if (!range.startDate || !range.endDate) return false;

  try {
    const start = parseISO(range.startDate);
    const end = parseISO(range.endDate);
    return isWithinInterval(date, { start, end });
  } catch {
    return false;
  }
}

/**
 * Check if a leave request overlaps with the selected range
 */
function doesLeaveOverlapRange(
  leave: LeaveRequestForCalendar,
  range: DateRange
): boolean {
  if (!range.startDate || !range.endDate) return false;

  try {
    const rangeStart = parseISO(range.startDate);
    const rangeEnd = parseISO(range.endDate);
    const leaveStart = parseISO(leave.startDate);
    const leaveEnd = parseISO(leave.endDate);

    // Check if leave overlaps with range
    return (
      (isWithinInterval(leaveStart, { start: rangeStart, end: rangeEnd }) ||
        isWithinInterval(leaveEnd, { start: rangeStart, end: rangeEnd }) ||
        (isBefore(leaveStart, rangeStart) && isAfter(leaveEnd, rangeEnd))) &&
      !isAfter(leaveStart, rangeEnd) &&
      !isBefore(leaveEnd, rangeStart)
    );
  } catch {
    return false;
  }
}

/**
 * DateRangePresets component
 */
export function DateRangePresets({
  onChange,
  initialRange,
  leaveRequests = [],
  showCalendar = true,
  className,
  allowRelativeSearch = true,
}: DateRangePresetsProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetType | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(
    initialRange || { startDate: null, endDate: null }
  );
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [relativeSearchQuery, setRelativeSearchQuery] = useState<string>("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [validationError, setValidationError] = useState<string>("");

  // Initialize custom dates from range
  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      setCustomStartDate(dateRange.startDate);
      setCustomEndDate(dateRange.endDate);
    }
  }, []);

  // Detect preset from current range
  useEffect(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setSelectedPreset(null);
      return;
    }

    const presets: PresetType[] = [
      "today",
      "tomorrow",
      "thisWeek",
      "thisMonth",
      "last7Days",
      "last30Days",
    ];

    for (const preset of presets) {
      const presetRange = getPresetRange(preset);
      if (
        presetRange.startDate === dateRange.startDate &&
        presetRange.endDate === dateRange.endDate
      ) {
        setSelectedPreset(preset);
        return;
      }
    }

    setSelectedPreset("custom");
  }, [dateRange]);

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (preset: PresetType) => {
      setSelectedPreset(preset);
      setValidationError("");

      if (preset === "custom") {
        setShowCustomPicker(true);
        // Keep existing custom dates if available
        if (customStartDate && customEndDate) {
          const newRange = {
            startDate: customStartDate,
            endDate: customEndDate,
          };
          setDateRange(newRange);
          onChange?.(newRange);
        }
      } else {
        setShowCustomPicker(false);
        const newRange = getPresetRange(preset);
        setDateRange(newRange);
        setCustomStartDate(newRange.startDate || "");
        setCustomEndDate(newRange.endDate || "");
        onChange?.(newRange);
      }
    },
    [customStartDate, customEndDate, onChange]
  );

  // Handle custom date changes
  const handleCustomDateChange = useCallback(
    (type: "start" | "end", value: string) => {
      if (type === "start") {
        setCustomStartDate(value);
        if (value && customEndDate) {
          // Validate
          if (isAfter(parseISO(value), parseISO(customEndDate))) {
            setValidationError("Start date must be before end date");
            return;
          }
          setValidationError("");
          const newRange = { startDate: value, endDate: customEndDate };
          setDateRange(newRange);
          onChange?.(newRange);
        }
      } else {
        setCustomEndDate(value);
        if (customStartDate && value) {
          // Validate
          if (isAfter(parseISO(customStartDate), parseISO(value))) {
            setValidationError("End date must be after start date");
            return;
          }
          setValidationError("");
          const newRange = { startDate: customStartDate, endDate: value };
          setDateRange(newRange);
          onChange?.(newRange);
        }
      }
    },
    [customStartDate, customEndDate, onChange]
  );

  // Handle relative search
  const handleRelativeSearch = useCallback(
    (query: string) => {
      setRelativeSearchQuery(query);
      const parsed = parseRelativeDate(query);
      if (parsed) {
        setDateRange(parsed);
        setCustomStartDate(parsed.startDate || "");
        setCustomEndDate(parsed.endDate || "");
        setSelectedPreset("custom");
        setShowCustomPicker(true);
        setValidationError("");
        onChange?.(parsed);
      }
    },
    [onChange]
  );

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [calendarDate]);

  // Map leave requests to calendar days
  const leaveMap = useMemo(() => {
    const map = new Map<string, LeaveRequestForCalendar[]>();
    leaveRequests.forEach((leave) => {
      try {
        let datesToProcess: Date[] = [];

        // Use selected_dates if available, otherwise use date range
        if (
          leave.selectedDates &&
          Array.isArray(leave.selectedDates) &&
          leave.selectedDates.length > 0
        ) {
          datesToProcess = leave.selectedDates
            .map((dateStr: string) => parseISO(dateStr))
            .filter((d: Date) => !isNaN(d.getTime()));
        } else {
          const leaveStart = parseISO(leave.startDate);
          const leaveEnd = parseISO(leave.endDate);
          datesToProcess = eachDayOfInterval({
            start: leaveStart,
            end: leaveEnd,
          });
        }

        datesToProcess.forEach((day) => {
          const iso = format(day, "yyyy-MM-dd");
          if (!map.has(iso)) {
            map.set(iso, []);
          }
          map.get(iso)!.push(leave);
        });
      } catch {
        // Skip invalid dates
      }
    });
    return map;
  }, [leaveRequests]);

  // Get leave color
  const getLeaveColor = (leaveType: string) => {
    const colors: Record<string, string> = {
      SIL: "bg-blue-100 border-blue-300 text-blue-800",
      LWOP: "bg-gray-100 border-gray-300 text-gray-800",
      "Maternity Leave": "bg-purple-100 border-purple-300 text-purple-800",
      "Paternity Leave": "bg-cyan-100 border-cyan-300 text-cyan-800",
    };
    return (
      colors[leaveType] || "bg-emerald-100 border-emerald-300 text-emerald-800"
    );
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <VStack gap="4">
          {/* Selected Range Display */}
          {dateRange.startDate && dateRange.endDate && (
            <div className="w-full p-3 bg-muted rounded-md border">
              <HStack gap="2" align="center" justify="between">
                <HStack gap="2" align="center">
                  <Icon name="CalendarBlank" size={IconSizes.sm} />
                  <BodySmall className="font-medium">
                    {formatDateRange(dateRange)}
                  </BodySmall>
                </HStack>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateRange({ startDate: null, endDate: null });
                    setCustomStartDate("");
                    setCustomEndDate("");
                    setSelectedPreset(null);
                    setShowCustomPicker(false);
                    setValidationError("");
                    onChange?.({ startDate: null, endDate: null });
                  }}
                >
                  <Icon name="X" size={IconSizes.sm} />
                </Button>
              </HStack>
            </div>
          )}

          {/* Relative Search */}
          {allowRelativeSearch && (
            <div>
              <Label className="mb-2 block text-xs">Quick Search</Label>
              <Input
                type="text"
                placeholder='Try "last 3 days", "next 7 days", "last week"'
                value={relativeSearchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setRelativeSearchQuery(query);
                  if (query.trim()) {
                    handleRelativeSearch(query);
                  }
                }}
                className="h-9 text-sm"
              />
              <Caption className="mt-1 text-xs text-muted-foreground">
                Supports: "last X days", "next X days", "last week", "last
                month"
              </Caption>
            </div>
          )}

          {/* Preset Buttons */}
          <div>
            <Label className="mb-2 block text-xs">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "today" as PresetType, label: "Today" },
                { key: "tomorrow" as PresetType, label: "Tomorrow" },
                { key: "thisWeek" as PresetType, label: "This Week" },
                { key: "thisMonth" as PresetType, label: "This Month" },
                { key: "last7Days" as PresetType, label: "Last 7 Days" },
                { key: "last30Days" as PresetType, label: "Last 30 Days" },
                { key: "custom" as PresetType, label: "Custom" },
              ].map((preset) => (
                <Button
                  key={preset.key}
                  variant={
                    selectedPreset === preset.key ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => handlePresetSelect(preset.key)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Date Picker */}
          {(showCustomPicker || selectedPreset === "custom") && (
            <div>
              <Label className="mb-2 block text-xs">Custom Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="start-date" className="text-xs">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) =>
                      handleCustomDateChange("start", e.target.value)
                    }
                    max={customEndDate || undefined}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) =>
                      handleCustomDateChange("end", e.target.value)
                    }
                    min={customStartDate || undefined}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {validationError && (
                <Caption className="mt-1 text-xs text-destructive">
                  {validationError}
                </Caption>
              )}
            </div>
          )}

          {/* Calendar View */}
          {showCalendar && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Icon name="CalendarBlank" size={IconSizes.sm} />
                  View Calendar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Select Date Range</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCalendarDate(
                          new Date(
                            calendarDate.getFullYear(),
                            calendarDate.getMonth() - 1,
                            1
                          )
                        )
                      }
                    >
                      <Icon name="CaretLeft" size={IconSizes.sm} />
                    </Button>
                    <BodySmall className="font-semibold">
                      {format(calendarDate, "MMMM yyyy")}
                    </BodySmall>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCalendarDate(
                          new Date(
                            calendarDate.getFullYear(),
                            calendarDate.getMonth() + 1,
                            1
                          )
                        )
                      }
                    >
                      <Icon name="CaretRight" size={IconSizes.sm} />
                    </Button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Day Headers */}
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div
                          key={day}
                          className="text-center text-xs font-semibold text-muted-foreground p-2"
                        >
                          {day}
                        </div>
                      )
                    )}

                    {/* Calendar Days */}
                    {calendarDays.map((day) => {
                      const iso = format(day, "yyyy-MM-dd");
                      const isCurrentMonth = isSameMonth(day, calendarDate);
                      const isToday = isSameDay(day, new Date());
                      const isInRange = isDateInRange(day, dateRange);
                      const isStart = dateRange.startDate === iso;
                      const isEnd = dateRange.endDate === iso;
                      const dayLeaves = leaveMap.get(iso) || [];
                      const hasLeaves = dayLeaves.length > 0;

                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => {
                            if (
                              !dateRange.startDate ||
                              (dateRange.startDate && dateRange.endDate)
                            ) {
                              // Start new selection
                              setCustomStartDate(iso);
                              setCustomEndDate("");
                              setDateRange({ startDate: iso, endDate: null });
                            } else if (
                              dateRange.startDate &&
                              !dateRange.endDate
                            ) {
                              // Complete selection
                              if (
                                isAfter(
                                  parseISO(iso),
                                  parseISO(dateRange.startDate)
                                ) ||
                                isSameDay(
                                  parseISO(iso),
                                  parseISO(dateRange.startDate)
                                )
                              ) {
                                setCustomEndDate(iso);
                                const newRange = {
                                  startDate: dateRange.startDate,
                                  endDate: iso,
                                };
                                setDateRange(newRange);
                                onChange?.(newRange);
                              } else {
                                // Swap if end is before start
                                setCustomStartDate(iso);
                                setCustomEndDate(dateRange.startDate);
                                const newRange = {
                                  startDate: iso,
                                  endDate: dateRange.startDate,
                                };
                                setDateRange(newRange);
                                onChange?.(newRange);
                              }
                            }
                          }}
                          className={cn(
                            "relative min-h-[60px] p-1 text-xs rounded border transition-colors",
                            !isCurrentMonth && "opacity-40",
                            isToday && "ring-2 ring-primary",
                            isInRange && "bg-primary/10",
                            isStart &&
                              "bg-primary text-primary-foreground font-semibold",
                            isEnd &&
                              "bg-primary text-primary-foreground font-semibold",
                            "hover:bg-accent"
                          )}
                        >
                          <div className="text-right font-medium mb-1">
                            {format(day, "d")}
                          </div>
                          {hasLeaves && (
                            <div className="space-y-0.5">
                              {dayLeaves.slice(0, 2).map((leave, idx) => (
                                <div
                                  key={`${leave.id}-${idx}`}
                                  className={cn(
                                    "text-[9px] px-1 py-0.5 rounded border truncate",
                                    getLeaveColor(leave.leaveType)
                                  )}
                                  title={`${leave.leaveType}${
                                    leave.employeeName
                                      ? ` - ${leave.employeeName}`
                                      : ""
                                  }`}
                                >
                                  {leave.leaveType}
                                </div>
                              ))}
                              {dayLeaves.length > 2 && (
                                <div className="text-[9px] text-muted-foreground">
                                  +{dayLeaves.length - 2}
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  {leaveRequests.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Caption className="text-xs font-semibold w-full">
                        Leave Types:
                      </Caption>
                      {Array.from(
                        new Set(leaveRequests.map((l) => l.leaveType))
                      ).map((type) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className={cn("text-xs", getLeaveColor(type))}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </VStack>
      </CardContent>
    </Card>
  );
}