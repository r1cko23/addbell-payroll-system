"use client";

import React, { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  isSameDay,
  isSameMonth,
  eachDayOfInterval,
  isBefore,
  isAfter,
  isToday,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VStack, HStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

/**
 * Props for MultiDatePicker component
 */
export interface MultiDatePickerProps {
  /**
   * Selected dates (ISO date strings)
   */
  selectedDates: string[];
  /**
   * Callback when dates change
   */
  onChange: (dates: string[]) => void;
  /**
   * Minimum selectable date (ISO date string)
   */
  minDate?: string;
  /**
   * Maximum selectable date (ISO date string)
   */
  maxDate?: string;
  /**
   * Holiday dates to exclude (ISO date strings)
   */
  holidayDates?: Set<string>;
  /**
   * Custom className
   */
  className?: string;
}

/**
 * Multi-date picker component that allows selecting multiple non-consecutive dates
 */
export function MultiDatePicker({
  selectedDates,
  onChange,
  minDate,
  maxDate,
  holidayDates = new Set(),
  className,
}: MultiDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Convert selected dates to Date objects for easier manipulation
  const selectedDatesSet = useMemo(() => {
    return new Set(selectedDates);
  }, [selectedDates]);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Check if a date is selectable
  const isDateSelectable = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    // Can't select past dates (but allow today)
    if (isBefore(dateOnly, today) && !isToday(dateOnly)) {
      return false;
    }

    // Check min/max constraints
    if (minDate) {
      const minDateObj = new Date(minDate);
      minDateObj.setHours(0, 0, 0, 0);
      if (isBefore(dateOnly, minDateObj)) {
        return false;
      }
    }
    if (maxDate) {
      const maxDateObj = new Date(maxDate);
      maxDateObj.setHours(0, 0, 0, 0);
      if (isAfter(dateOnly, maxDateObj)) {
        return false;
      }
    }

    return true;
  };

  // Toggle date selection
  const toggleDate = (date: Date) => {
    if (!isDateSelectable(date)) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const newSelectedDates = [...selectedDates];

    if (selectedDatesSet.has(dateStr)) {
      // Remove date
      const index = newSelectedDates.indexOf(dateStr);
      if (index > -1) {
        newSelectedDates.splice(index, 1);
      }
    } else {
      // Add date
      newSelectedDates.push(dateStr);
    }

    // Sort dates
    newSelectedDates.sort();
    onChange(newSelectedDates);
  };

  // Navigate months
  const previousMonth = () => {
    setCurrentMonth(subDays(startOfMonth(currentMonth), 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addDays(endOfMonth(currentMonth), 1));
  };

  // Get date classes
  const getDateClasses = (date: Date): string => {
    const dateStr = format(date, "yyyy-MM-dd");
    const isSelected = selectedDatesSet.has(dateStr);
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isHoliday = holidayDates.has(dateStr);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isSelectable = isDateSelectable(date);

    return cn(
      "w-10 h-10 rounded-md flex items-center justify-center text-sm font-medium transition-colors",
      {
        "text-muted-foreground": !isCurrentMonth,
        "bg-emerald-100 text-emerald-900 border-2 border-emerald-500":
          isSelected,
        "bg-muted text-muted-foreground cursor-not-allowed": !isSelectable,
        "bg-red-50 text-red-600": isHoliday && !isSelected,
        "bg-blue-50 text-blue-600": isToday(date) && !isSelected,
        "hover:bg-accent hover:text-accent-foreground":
          isSelectable && !isSelected && isCurrentMonth,
        "cursor-pointer": isSelectable,
        "cursor-not-allowed": !isSelectable,
      }
    );
  };

  // Remove date from list
  const removeDate = (dateStr: string) => {
    const newSelectedDates = selectedDates.filter((d) => d !== dateStr);
    onChange(newSelectedDates);
  };

  // Clear all dates
  const clearAll = () => {
    onChange([]);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <VStack gap="4" className="w-full">
          {/* Header */}
          <div className="flex items-center justify-between w-full">
            <HStack gap="2" align="center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewMode(viewMode === "calendar" ? "list" : "calendar")
                }
              >
                <Icon
                  name={viewMode === "calendar" ? "List" : "CalendarBlank"}
                  size={IconSizes.sm}
                />
                {viewMode === "calendar" ? "List View" : "Calendar View"}
              </Button>
            </HStack>
            <BodySmall className="font-semibold">
              {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""}{" "}
              selected
            </BodySmall>
          </div>

          {viewMode === "calendar" ? (
            <>
              {/* Month Navigation */}
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={previousMonth}
                  disabled={isBefore(startOfMonth(currentMonth), new Date())}
                >
                  <Icon name="CaretLeft" size={IconSizes.sm} />
                </Button>
                <BodySmall className="font-semibold">
                  {format(currentMonth, "MMMM yyyy")}
                </BodySmall>
                <Button variant="ghost" size="sm" onClick={nextMonth}>
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </div>

              {/* Calendar Grid */}
              <div className="w-full">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-semibold text-muted-foreground py-1"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isSelected = selectedDatesSet.has(dateStr);
                    const isHoliday = holidayDates.has(dateStr);

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => toggleDate(date)}
                        className={getDateClasses(date)}
                        disabled={!isDateSelectable(date)}
                        title={
                          isHoliday
                            ? "Holiday"
                            : isSelected
                            ? "Click to deselect"
                            : "Click to select"
                        }
                      >
                        {format(date, "d")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-500" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
                  <span>Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-50 border border-blue-200" />
                  <span>Today</span>
                </div>
              </div>
            </>
          ) : (
            /* List View */
            <VStack gap="2" className="w-full">
              {selectedDates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon
                    name="CalendarBlank"
                    size={IconSizes.lg}
                    className="mx-auto mb-2 opacity-50"
                  />
                  <BodySmall>No dates selected</BodySmall>
                  <Caption>Switch to calendar view to select dates</Caption>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between w-full">
                    <BodySmall className="font-semibold">
                      Selected Dates ({selectedDates.length})
                    </BodySmall>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAll}
                      className="text-destructive hover:text-destructive"
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedDates.map((dateStr) => {
                      const date = new Date(dateStr);
                      const isHoliday = holidayDates.has(dateStr);
                      const isWeekend =
                        date.getDay() === 0 || date.getDay() === 6;

                      return (
                        <div
                          key={dateStr}
                          className="flex items-center justify-between p-2 border rounded-md bg-card"
                        >
                          <div className="flex items-center gap-2">
                            <Icon
                              name="CalendarBlank"
                              size={IconSizes.sm}
                              className="text-muted-foreground"
                            />
                            <div>
                              <BodySmall className="font-medium">
                                {format(date, "EEEE, MMMM d, yyyy")}
                              </BodySmall>
                              <div className="flex gap-2 mt-1">
                                {isHoliday && (
                                  <Badge variant="outline" className="text-xs">
                                    Holiday
                                  </Badge>
                                )}
                                {isWeekend && (
                                  <Badge variant="outline" className="text-xs">
                                    Weekend
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDate(dateStr)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Icon name="X" size={IconSizes.sm} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </VStack>
          )}
        </VStack>
      </CardContent>
    </Card>
  );
}

