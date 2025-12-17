# SearchAndFilter Component

A unified search and filter component for leave requests with advanced search syntax, debouncing, search highlighting, and integration with filter panels.

## Features

- ✅ **Instant Search**: Search across employee names, IDs, and departments
- ✅ **Debounced Input**: Optimized performance with configurable debounce delay
- ✅ **Advanced Search Syntax**: Support for `date:`, `status:`, `employee:`, `department:`, `type:` filters
- ✅ **Search Highlights**: Visual highlighting of matching terms
- ✅ **Recent Searches**: Dropdown with recent search history
- ✅ **Saved Filters**: Quick access to saved filter configurations
- ✅ **Result Summary**: Shows "X results for 'query'" message
- ✅ **Unified Output**: Returns both search query and filter configuration
- ✅ **Storage Integration**: Persists recent searches to sessionStorage

## Installation

The component uses:

- `hooks/use-debounce.ts` - Debounce hook (included)
- `date-fns` - For date parsing and formatting
- Existing UI components

## Basic Usage

```tsx
import {
  SearchAndFilter,
  type SearchAndFilterResult,
} from "@/components/SearchAndFilter";

function LeaveRequestPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);

  const handleChange = (result: SearchAndFilterResult) => {
    console.log("Search:", result.searchQuery.raw);
    console.log("Filters:", result.filters);
    console.log("Matches:", result.matchCount);
  };

  return (
    <SearchAndFilter leaveRequests={leaveRequests} onChange={handleChange} />
  );
}
```

## Props

### SearchAndFilterProps

| Prop                | Type                                      | Default                       | Description                         |
| ------------------- | ----------------------------------------- | ----------------------------- | ----------------------------------- |
| `leaveRequests`     | `LeaveRequestCardData[]`                  | **required**                  | All leave requests for searching    |
| `currentFilters`    | `LeaveRequestFilterConfig`                | `undefined`                   | Current filter configuration        |
| `onChange`          | `(result: SearchAndFilterResult) => void` | `undefined`                   | Callback when search/filters change |
| `debounceDelay`     | `number`                                  | `300`                         | Debounce delay in milliseconds      |
| `storageKey`        | `string`                                  | `"leaveRequestSearchHistory"` | Key for sessionStorage              |
| `maxRecentSearches` | `number`                                  | `10`                          | Maximum recent searches to save     |
| `className`         | `string`                                  | `undefined`                   | Custom CSS classes                  |

## Advanced Search Syntax

The component supports advanced search syntax for precise filtering:

### Date Filter

```
date:2025-12-11
```

Searches for requests starting on the specified date (ISO format: YYYY-MM-DD).

### Status Filter

```
status:pending
status:approved_by_manager
status:rejected
```

Filters by leave request status.

### Employee Filter

```
employee:John
employee:EMP001
```

Searches by employee name or ID.

### Department Filter

```
department:Engineering
department:Sales
```

Filters by department name.

### Leave Type Filter

```
type:SIL
type:LWOP
leavetype:Maternity Leave
```

Filters by leave type (case-insensitive).

### Combined Search

You can combine multiple filters and plain text:

```
John date:2025-12-11 status:pending
```

This searches for "John" in names/IDs, filters by date and status.

## Search Query Structure

The component returns a structured search query:

```typescript
interface SearchQuery {
  raw: string; // Original query string
  terms: string[]; // Plain text search terms
  advanced: {
    date?: string; // ISO date string
    status?: string;
    employee?: string;
    department?: string;
    leaveType?: string;
  };
}
```

## Search Highlighting

Use the `highlightSearchTerms` utility to highlight matches in results:

```tsx
import { highlightSearchTerms } from "@/components/SearchAndFilter";

function EmployeeName({ name, searchQuery }) {
  return <span>{highlightSearchTerms(name, searchQuery)}</span>;
}
```

The function returns React nodes with `<mark>` tags around matching text.

## Integration with FilterPanel

Combine SearchAndFilter with FilterPanel for complete filtering:

```tsx
import { SearchAndFilter } from "@/components/SearchAndFilter";
import { FilterPanel } from "@/components/FilterPanel";
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";

function LeaveRequestPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filters, setFilters] = useState(/* ... */);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (result: SearchAndFilterResult) => {
    setSearchQuery(result.searchQuery.raw);
    setFilters(result.filters);
  };

  const handleFilterChange = (
    newFilters: LeaveRequestFilterConfig,
    count: number
  ) => {
    setFilters(newFilters);
  };

  // Apply both search and filters
  const filtered = useMemo(() => {
    // Search is applied internally by SearchAndFilter
    // Then apply filters
    return filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date",
      "date-asc"
    );
  }, [leaveRequests, filters]);

  return (
    <>
      <SearchAndFilter
        leaveRequests={leaveRequests}
        currentFilters={filters}
        onChange={handleSearchChange}
      />
      <FilterPanel
        leaveRequests={leaveRequests}
        onFilterChange={handleFilterChange}
      />
      <GroupedLeaveList groupedData={filtered} />
    </>
  );
}
```

## Complete Example

```tsx
"use client";

import { useState, useMemo } from "react";
import {
  SearchAndFilter,
  type SearchAndFilterResult,
} from "@/components/SearchAndFilter";
import {
  FilterPanel,
  type LeaveRequestFilterConfig,
} from "@/components/FilterPanel";
import { GroupedLeaveList } from "@/components/GroupedLeaveList";
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";
import type { LeaveRequestCardData } from "@/components/LeaveRequestCard";

export default function LeaveRequestPage() {
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

  // Handle search and filter changes
  const handleSearchChange = (result: SearchAndFilterResult) => {
    // Search is applied to leaveRequests automatically
    // Update filters if needed
    setFilters(result.filters);
  };

  const handleFilterChange = (
    newFilters: LeaveRequestFilterConfig,
    count: number
  ) => {
    setFilters(newFilters);
  };

  // Apply filters and group (search is handled by SearchAndFilter)
  const grouped = useMemo(() => {
    return filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date",
      "date-asc"
    );
  }, [leaveRequests, filters]);

  return (
    <div className="space-y-6">
      <SearchAndFilter
        leaveRequests={leaveRequests}
        currentFilters={filters}
        onChange={handleSearchChange}
      />

      <FilterPanel
        leaveRequests={leaveRequests}
        onFilterChange={handleFilterChange}
      />

      <GroupedLeaveList groupedData={grouped} userRole="account_manager" />
    </div>
  );
}
```

## Recent Searches

The component automatically saves recent searches to sessionStorage:

- Maximum 10 searches saved (configurable)
- Accessible via dropdown when input is focused
- Cleared when browser session ends

## Saved Filters

Save and load filter configurations:

- Filters are saved to sessionStorage
- Quick access buttons for saved filters
- Useful for frequently used filter combinations

## Search Behavior

### Plain Text Search

Searches across:

- Employee names
- Employee IDs
- Departments
- Leave types
- Request IDs

All terms must match (AND logic).

### Advanced Filters

Extracted from query string and applied as filters:

- `date:` filters by start date
- `status:` filters by status
- `employee:` filters by employee name/ID
- `department:` filters by department
- `type:` filters by leave type

### Combined Search

You can combine plain text and advanced filters:

```
John date:2025-12-11
```

Searches for "John" AND filters by date.

## Performance

- **Debouncing**: Default 300ms delay prevents excessive searches
- **Memoization**: Search results are memoized
- **Efficient Filtering**: Only filters when query changes
- **Storage Optimization**: Limits saved searches

## Accessibility

- ✅ Proper semantic HTML
- ✅ Keyboard navigation support
- ✅ ARIA labels where needed
- ✅ Focus indicators
- ✅ Screen reader friendly

## Related Components

- `FilterPanel` - Advanced filtering UI
- `GroupedLeaveList` - Display grouped results
- `LeaveRequestCard` - Individual request cards
- `hooks/use-debounce.ts` - Debounce utility

## Tips

1. **Use Advanced Syntax**: For precise filtering, use `date:`, `status:`, etc.
2. **Combine Filters**: Mix plain text and advanced filters for powerful searches
3. **Save Common Filters**: Use saved filters for frequently used combinations
4. **Check Recent Searches**: Access recent searches via dropdown
5. **Highlight Results**: Use `highlightSearchTerms` to show matches in results











