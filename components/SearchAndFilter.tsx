"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VStack, HStack } from "@/components/ui/stack";
import { BodySmall, Caption, H4 } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { parseISO, format, isValid } from "date-fns";
import type { LeaveRequestFilterConfig } from "./FilterPanel";
import type { LeaveRequestCardData } from "./LeaveRequestCard";

/**
 * Search query interface
 */
export interface SearchQuery {
  /**
   * Raw search query string
   */
  raw: string;
  /**
   * Parsed search terms
   */
  terms: string[];
  /**
   * Advanced search filters extracted from query
   */
  advanced: {
    date?: string; // ISO date string
    status?: string;
    employee?: string;
    department?: string;
    leaveType?: string;
  };
}

/**
 * Search and filter result interface
 */
export interface SearchAndFilterResult {
  /**
   * Search query object
   */
  searchQuery: SearchQuery;
  /**
   * Filter configuration
   */
  filters: LeaveRequestFilterConfig;
  /**
   * Total matching count
   */
  matchCount: number;
}

/**
 * Props for SearchAndFilter component
 */
export interface SearchAndFilterProps {
  /**
   * All leave requests for searching
   */
  leaveRequests: LeaveRequestCardData[];
  /**
   * Current filter configuration
   */
  currentFilters?: LeaveRequestFilterConfig;
  /**
   * Callback when search or filters change
   */
  onChange?: (result: SearchAndFilterResult) => void;
  /**
   * Debounce delay in milliseconds (default: 300)
   */
  debounceDelay?: number;
  /**
   * Storage key for saving recent searches/filters (default: "leaveRequestSearchHistory")
   */
  storageKey?: string;
  /**
   * Maximum number of recent searches to save (default: 10)
   */
  maxRecentSearches?: number;
  /**
   * Custom className
   */
  className?: string;
}

/**
 * Parse advanced search syntax from query string
 * Supports: date:2025-12-11, status:pending, employee:name, department:Engineering, type:SIL
 */
function parseAdvancedSearch(query: string): SearchQuery["advanced"] {
  const advanced: SearchQuery["advanced"] = {};
  const patterns = {
    date: /date:(\d{4}-\d{2}-\d{2})/i,
    status: /status:(\w+)/i,
    employee: /employee:([^\s]+)/i,
    department: /department:([^\s]+)/i,
    leaveType: /(?:type|leavetype):(\w+)/i,
  };

  // Extract date filter
  const dateMatch = query.match(patterns.date);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    if (isValid(parseISO(dateStr))) {
      advanced.date = dateStr;
    }
  }

  // Extract status filter
  const statusMatch = query.match(patterns.status);
  if (statusMatch) {
    advanced.status = statusMatch[1].toLowerCase();
  }

  // Extract employee filter
  const employeeMatch = query.match(patterns.employee);
  if (employeeMatch) {
    advanced.employee = employeeMatch[1];
  }

  // Extract department filter
  const departmentMatch = query.match(patterns.department);
  if (departmentMatch) {
    advanced.department = departmentMatch[1];
  }

  // Extract leave type filter
  const leaveTypeMatch = query.match(patterns.leaveType);
  if (leaveTypeMatch) {
    advanced.leaveType = leaveTypeMatch[1].toUpperCase();
  }

  return advanced;
}

/**
 * Extract plain text search terms (excluding advanced syntax)
 */
function extractSearchTerms(query: string): string[] {
  // Remove advanced search patterns
  const cleaned = query
    .replace(/date:\d{4}-\d{2}-\d{2}/gi, "")
    .replace(/status:\w+/gi, "")
    .replace(/employee:[^\s]+/gi, "")
    .replace(/department:[^\s]+/gi, "")
    .replace(/(?:type|leavetype):\w+/gi, "")
    .trim();

  // Split into terms
  return cleaned
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .map((term) => term.toLowerCase());
}

/**
 * Parse search query into structured format
 */
function parseSearchQuery(query: string): SearchQuery {
  const advanced = parseAdvancedSearch(query);
  const terms = extractSearchTerms(query);

  return {
    raw: query,
    terms,
    advanced,
  };
}

/**
 * Apply search query to leave requests
 */
function applySearch(
  requests: LeaveRequestCardData[],
  searchQuery: SearchQuery
): LeaveRequestCardData[] {
  if (
    !searchQuery.raw.trim() &&
    Object.keys(searchQuery.advanced).length === 0
  ) {
    return requests;
  }

  return requests.filter((request) => {
    // Check advanced filters first
    if (searchQuery.advanced.date) {
      const requestDate = format(parseISO(request.startDate), "yyyy-MM-dd");
      if (requestDate !== searchQuery.advanced.date) {
        return false;
      }
    }

    if (searchQuery.advanced.status) {
      const normalizedStatus = request.status.toLowerCase().replace(/_/g, "");
      if (!normalizedStatus.includes(searchQuery.advanced.status)) {
        return false;
      }
    }

    if (searchQuery.advanced.employee) {
      const employeeMatch =
        request.employeeName
          .toLowerCase()
          .includes(searchQuery.advanced.employee.toLowerCase()) ||
        request.employeeId
          .toLowerCase()
          .includes(searchQuery.advanced.employee.toLowerCase());
      if (!employeeMatch) {
        return false;
      }
    }

    if (searchQuery.advanced.department) {
      if (
        !request.department ||
        !request.department
          .toLowerCase()
          .includes(searchQuery.advanced.department.toLowerCase())
      ) {
        return false;
      }
    }

    if (searchQuery.advanced.leaveType) {
      if (request.leaveType.toUpperCase() !== searchQuery.advanced.leaveType) {
        return false;
      }
    }

    // Check plain text search terms
    if (searchQuery.terms.length > 0) {
      const searchableText = [
        request.employeeName,
        request.employeeId,
        request.department || "",
        request.leaveType,
        request.id,
      ]
        .join(" ")
        .toLowerCase();

      const matchesAllTerms = searchQuery.terms.every((term) =>
        searchableText.includes(term)
      );

      if (!matchesAllTerms) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(
  text: string,
  searchQuery: SearchQuery
): React.ReactNode {
  if (!searchQuery.raw.trim() || searchQuery.terms.length === 0) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Find all matches
  const matches: Array<{ start: number; end: number }> = [];
  searchQuery.terms.forEach((term) => {
    let index = lowerText.indexOf(term, lastIndex);
    while (index !== -1) {
      matches.push({ start: index, end: index + term.length });
      index = lowerText.indexOf(term, index + 1);
    }
  });

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Merge overlapping matches
  const mergedMatches: Array<{ start: number; end: number }> = [];
  matches.forEach((match) => {
    const last = mergedMatches[mergedMatches.length - 1];
    if (last && match.start <= last.end) {
      last.end = Math.max(last.end, match.end);
    } else {
      mergedMatches.push({ ...match });
    }
  });

  // Build highlighted text
  mergedMatches.forEach((match) => {
    // Add text before match
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }

    // Add highlighted match
    parts.push(
      <mark
        key={`${match.start}-${match.end}`}
        className="bg-yellow-200 text-yellow-900 px-0.5 rounded"
      >
        {text.substring(match.start, match.end)}
      </mark>
    );

    lastIndex = match.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

/**
 * SearchAndFilter component - Unified search and filter interface
 */
export function SearchAndFilter({
  leaveRequests,
  currentFilters,
  onChange,
  debounceDelay = 300,
  storageKey = "leaveRequestSearchHistory",
  maxRecentSearches = 10,
  className,
}: SearchAndFilterProps) {
  const [searchInput, setSearchInput] = useState("");
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedFilters, setSavedFilters] = useState<
    Array<{
      name: string;
      filters: LeaveRequestFilterConfig;
    }>
  >([]);

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, debounceDelay);

  // Parse search query
  const searchQuery = useMemo(
    () => parseSearchQuery(debouncedSearch),
    [debouncedSearch]
  );

  // Load recent searches and saved filters from storage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const recent = sessionStorage.getItem(`${storageKey}_recent`);
      if (recent) {
        setRecentSearches(JSON.parse(recent));
      }

      const saved = sessionStorage.getItem(`${storageKey}_filters`);
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading search history:", error);
    }
  }, [storageKey]);

  // Save recent searches
  const saveRecentSearch = useCallback(
    (query: string) => {
      if (!query.trim()) return;

      setRecentSearches((prev) => {
        const updated = [query, ...prev.filter((q) => q !== query)].slice(
          0,
          maxRecentSearches
        );

        try {
          sessionStorage.setItem(
            `${storageKey}_recent`,
            JSON.stringify(updated)
          );
        } catch (error) {
          console.error("Error saving recent searches:", error);
        }

        return updated;
      });
    },
    [storageKey, maxRecentSearches]
  );

  // Apply search to requests
  const filteredRequests = useMemo(() => {
    return applySearch(leaveRequests, searchQuery);
  }, [leaveRequests, searchQuery]);

  // Notify parent of changes
  useEffect(() => {
    if (debouncedSearch.trim()) {
      saveRecentSearch(debouncedSearch);
    }

    onChange?.({
      searchQuery,
      filters: currentFilters || {
        dateRange: { preset: null, startDate: null, endDate: null },
        status: [],
        leaveType: [],
        employeeIds: [],
        departments: [],
        approvalStage: [],
      },
      matchCount: filteredRequests.length,
    });
  }, [
    searchQuery,
    currentFilters,
    filteredRequests.length,
    onChange,
    debouncedSearch,
    saveRecentSearch,
  ]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  // Load recent search
  const loadRecentSearch = useCallback((query: string) => {
    setSearchInput(query);
    setShowRecentSearches(false);
  }, []);

  // Load saved filter
  const loadSavedFilter = useCallback(
    (filters: LeaveRequestFilterConfig) => {
      onChange?.({
        searchQuery: { raw: "", terms: [], advanced: {} },
        filters,
        matchCount: leaveRequests.length,
      });
    },
    [onChange, leaveRequests.length]
  );

  const hasAdvancedFilters = Object.keys(searchQuery.advanced).length > 0;
  const hasSearch = searchQuery.raw.trim().length > 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <VStack gap="4">
          {/* Search Input */}
          <div className="relative w-full">
            <div className="relative">
              <Icon
                name="MagnifyingGlass"
                size={IconSizes.md}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder="Search by name, ID, department... (e.g., date:2025-12-11, status:pending)"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowRecentSearches(true);
                }}
                onFocus={() => setShowRecentSearches(true)}
                onBlur={() => {
                  // Delay to allow click on recent searches
                  setTimeout(() => setShowRecentSearches(false), 200);
                }}
                className="pl-10 pr-10"
              />
              {hasSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                >
                  <Icon name="X" size={IconSizes.sm} />
                </Button>
              )}
            </div>

            {/* Recent Searches Dropdown */}
            {showRecentSearches && recentSearches.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <Caption className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Recent Searches
                  </Caption>
                  {recentSearches.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => loadRecentSearch(query)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded-md flex items-center gap-2"
                    >
                      <Icon
                        name="ClockClockwise"
                        size={IconSizes.sm}
                        className="text-muted-foreground"
                      />
                      <span className="truncate">{query}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search Summary */}
          {hasSearch && (
            <HStack justify="between" align="center" className="flex-wrap">
              <HStack gap="2" align="center" className="flex-wrap">
                <BodySmall className="text-muted-foreground">
                  <strong>{filteredRequests.length}</strong> result
                  {filteredRequests.length !== 1 ? "s" : ""} for{" "}
                  <strong>&quot;{searchQuery.raw}&quot;</strong>
                </BodySmall>
                {hasAdvancedFilters && (
                  <Badge variant="secondary" className="text-xs">
                    Advanced
                  </Badge>
                )}
              </HStack>
            </HStack>
          )}

          {/* Advanced Filters Display */}
          {hasAdvancedFilters && (
            <div className="flex flex-wrap gap-2">
              {searchQuery.advanced.date && (
                <Badge variant="outline" className="text-xs">
                  <Icon name="CalendarBlank" size={IconSizes.xs} />
                  Date:{" "}
                  {format(parseISO(searchQuery.advanced.date), "MMM dd, yyyy")}
                </Badge>
              )}
              {searchQuery.advanced.status && (
                <Badge variant="outline" className="text-xs">
                  Status: {searchQuery.advanced.status}
                </Badge>
              )}
              {searchQuery.advanced.employee && (
                <Badge variant="outline" className="text-xs">
                  Employee: {searchQuery.advanced.employee}
                </Badge>
              )}
              {searchQuery.advanced.department && (
                <Badge variant="outline" className="text-xs">
                  Department: {searchQuery.advanced.department}
                </Badge>
              )}
              {searchQuery.advanced.leaveType && (
                <Badge variant="outline" className="text-xs">
                  Type: {searchQuery.advanced.leaveType}
                </Badge>
              )}
            </div>
          )}

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div>
              <HStack gap="2" align="center" className="mb-2">
                <Icon
                  name="FloppyDisk"
                  size={IconSizes.sm}
                  className="text-muted-foreground"
                />
                <Caption className="text-xs font-semibold">
                  Saved Filters
                </Caption>
              </HStack>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((saved, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => loadSavedFilter(saved.filters)}
                    className="text-xs"
                  >
                    {saved.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </VStack>
      </CardContent>
    </Card>
  );
}
