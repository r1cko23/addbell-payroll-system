/**
 * Example usage of the SearchAndFilter component
 *
 * This file demonstrates how to integrate SearchAndFilter with leave request data
 */

"use client";

import { useState, useMemo } from "react";
import { SearchAndFilter, type SearchAndFilterResult } from "./SearchAndFilter";
import { GroupedLeaveList } from "./GroupedLeaveList";
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";
import { highlightSearchTerms } from "./SearchAndFilter";
import type { LeaveRequestCardData } from "./LeaveRequestCard";
import type { LeaveRequestFilterConfig } from "./FilterPanel";

/**
 * Example: Basic search integration
 */
export function BasicSearchAndFilterExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([]);
  const [searchResult, setSearchResult] =
    useState<SearchAndFilterResult | null>(null);

  return (
    <div className="space-y-4">
      <SearchAndFilter
        leaveRequests={leaveRequests}
        onChange={(result) => {
          setSearchResult(result);
          console.log("Search query:", result.searchQuery);
          console.log("Filters:", result.filters);
          console.log("Match count:", result.matchCount);
        }}
      />
    </div>
  );
}

/**
 * Example: Complete integration with GroupedLeaveList
 */
export function CompleteSearchAndFilterExample() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestCardData[]>(
    []
  );
  const [filters, setFilters] = useState<LeaveRequestFilterConfig>({
    dateRange: { preset: null, startDate: null, endDate: null },
    status: [],
    leaveType: [],
    employeeIds: [],
    departments: [],
    approvalStage: [],
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Apply search first, then filters
  const filteredAndGrouped = useMemo(() => {
    // First apply search (this would be done by SearchAndFilter internally)
    // Then apply filters and group
    return filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date",
      "date-asc"
    );
  }, [leaveRequests, filters]);

  const handleSearchAndFilterChange = (result: SearchAndFilterResult) => {
    setSearchQuery(result.searchQuery.raw);
    setFilters(result.filters);
  };

  return (
    <div className="space-y-6">
      <SearchAndFilter
        leaveRequests={leaveRequests}
        currentFilters={filters}
        onChange={handleSearchAndFilterChange}
      />

      <GroupedLeaveList
        groupedData={filteredAndGrouped}
        userRole="account_manager"
      />
    </div>
  );
}

/**
 * Example: Using advanced search syntax
 */
export function AdvancedSearchExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([]);

  return (
    <SearchAndFilter
      leaveRequests={leaveRequests}
      onChange={(result) => {
        console.log("Advanced filters:", result.searchQuery.advanced);
        // Examples:
        // "date:2025-12-11" -> { date: "2025-12-11" }
        // "status:pending" -> { status: "pending" }
        // "employee:John" -> { employee: "John" }
        // "department:Engineering" -> { department: "Engineering" }
        // "type:SIL" -> { leaveType: "SIL" }
      }}
    />
  );
}

/**
 * Example: Highlighting search terms in results
 */
export function SearchHighlightExample() {
  const searchQuery = {
    raw: "John Engineering",
    terms: ["john", "engineering"],
    advanced: {},
  };

  const employeeName = "John Doe";
  const department = "Engineering Department";

  return (
    <div>
      <p>Employee: {highlightSearchTerms(employeeName, searchQuery)}</p>
      <p>Department: {highlightSearchTerms(department, searchQuery)}</p>
    </div>
  );
}

/**
 * Example: With saved filters
 */
export function SavedFiltersExample() {
  const [leaveRequests] = useState<LeaveRequestCardData[]>([]);

  return (
    <SearchAndFilter
      leaveRequests={leaveRequests}
      storageKey="myCustomSearchHistory"
      maxRecentSearches={5}
      onChange={(result) => {
        // Handle search and filter changes
      }}
    />
  );
}











