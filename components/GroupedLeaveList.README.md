# GroupedLeaveList Component

A comprehensive component for displaying grouped leave requests with collapsible sections, virtual scrolling, sticky headers, and summary statistics.

## Features

- ✅ **Collapsible Sections**: Expand/collapse individual groups
- ✅ **Sticky Headers**: Section headers stay visible while scrolling
- ✅ **Summary Statistics**: Shows count and total days/hours per group
- ✅ **Virtual Scrolling**: Optimized rendering for large lists (20+ items)
- ✅ **Scroll Position Preservation**: Maintains scroll position when collapsing/expanding
- ✅ **Empty States**: Shows helpful messages when groups are empty
- ✅ **Expand/Collapse All**: Bulk actions for all sections
- ✅ **Responsive Grid**: Adapts to screen size (1-3 columns)
- ✅ **Integration**: Works seamlessly with LeaveRequestCard and FilterPanel

## Installation

The component uses existing UI components and utilities:

- `date-fns` - For date calculations
- Existing UI components (`Card`, `Badge`, `Button`, etc.)
- `LeaveRequestCard` component

## Basic Usage

```tsx
import { GroupedLeaveList } from "@/components/GroupedLeaveList";
import { groupLeaveRequests } from "@/utils/leave-requests";

function LeaveRequestPage() {
  const leaveRequests = [
    /* your leave requests */
  ];

  // Group by date
  const grouped = groupLeaveRequests(leaveRequests, "date", "date-asc");

  return (
    <GroupedLeaveList
      groupedData={grouped}
      userRole="account_manager"
      onApprove={(id, level) => handleApprove(id, level)}
      onReject={(id) => handleReject(id)}
      onViewDetails={(id) => handleViewDetails(id)}
    />
  );
}
```

## Props

### GroupedLeaveListProps

| Prop                     | Type                                                 | Default      | Description                                          |
| ------------------------ | ---------------------------------------------------- | ------------ | ---------------------------------------------------- |
| `groupedData`            | `NestedGroupedLeaveRequests`                         | **required** | Grouped leave request data from `groupLeaveRequests` |
| `userRole`               | `"account_manager" \| "hr" \| "admin" \| "employee"` | `undefined`  | Current user role for context-aware actions          |
| `onApprove`              | `(id: string, level: "manager" \| "hr") => void`     | `undefined`  | Callback when approve button is clicked              |
| `onReject`               | `(id: string) => void`                               | `undefined`  | Callback when reject button is clicked               |
| `onViewDetails`          | `(id: string) => void`                               | `undefined`  | Callback when view details is clicked                |
| `showActions`            | `boolean`                                            | `true`       | Whether to show action buttons                       |
| `virtualScrollThreshold` | `number`                                             | `20`         | Threshold for enabling virtual scrolling             |
| `className`              | `string`                                             | `undefined`  | Custom CSS classes                                   |
| `defaultExpanded`        | `boolean`                                            | `true`       | Whether sections are expanded by default             |

## Grouped Data Structure

The component expects data in the format returned by `groupLeaveRequests`:

```typescript
interface NestedGroupedLeaveRequests {
  groups: Array<{
    key: string;
    label: string;
    count: number;
    items: LeaveRequest[];
  }>;
}
```

## Section Headers

Each section header displays:

- **Group Label**: The category name (e.g., "Today", "Pending")
- **Count Badge**: Number of requests in the group
- **Summary Stats**: Total days/hours (hidden on mobile)
- **Expand/Collapse Icon**: Visual indicator of section state

Headers are sticky and remain visible while scrolling through section content.

## Summary Statistics

Each section calculates and displays:

- **Total Days**: Sum of all leave days in the group
- **Total Hours**: Sum of all offset hours in the group
- **Format**: "X days • Y hours" (or just one if applicable)

## Virtual Scrolling

When a section contains more than `virtualScrollThreshold` items (default: 20):

- Only visible items are rendered
- Scroll position is maintained
- Performance is optimized for large lists
- Container height is limited to 600px (or 70vh)

To disable virtual scrolling, set `virtualScrollThreshold` to a very high number.

## Scroll Position Preservation

When collapsing and expanding sections:

- Scroll position is saved before collapsing
- Position is restored after expanding
- Smooth user experience without losing context

## Empty States

The component shows appropriate empty states:

- **No Groups**: "No leave requests found" with calendar icon
- **Empty Section**: "No requests in this group" within collapsed section

## Expand/Collapse Controls

- **Individual Sections**: Click section header to toggle
- **Expand All**: Button in header expands all sections
- **Collapse All**: Button in header collapses all sections
- **Default State**: Controlled by `defaultExpanded` prop

## Complete Example

```tsx
"use client";

import { useState, useMemo } from "react";
import { GroupedLeaveList } from "@/components/GroupedLeaveList";
import {
  FilterPanel,
  type LeaveRequestFilterConfig,
} from "@/components/FilterPanel";
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

  // Filter and group
  const grouped = useMemo(() => {
    return filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date", // groupBy
      "date-asc" // sortBy
    );
  }, [leaveRequests, filters]);

  const handleFilterChange = (
    newFilters: LeaveRequestFilterConfig,
    count: number
  ) => {
    setFilters(newFilters);
  };

  const handleApprove = async (id: string, level: "manager" | "hr") => {
    // Your approval logic
  };

  const handleReject = async (id: string) => {
    // Your rejection logic
  };

  const handleViewDetails = (id: string) => {
    // Open details modal or navigate
  };

  return (
    <div className="space-y-6">
      <FilterPanel
        leaveRequests={leaveRequests}
        onFilterChange={handleFilterChange}
      />

      <GroupedLeaveList
        groupedData={grouped}
        userRole="account_manager"
        onApprove={handleApprove}
        onReject={handleReject}
        onViewDetails={handleViewDetails}
        showActions={true}
        defaultExpanded={true}
        virtualScrollThreshold={20}
      />
    </div>
  );
}
```

## Integration with FilterPanel

The component works seamlessly with FilterPanel:

```tsx
import { FilterPanel } from "@/components/FilterPanel";
import { GroupedLeaveList } from "@/components/GroupedLeaveList";
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";

function LeaveRequestPage() {
  const [filters, setFilters] = useState(/* ... */);
  const [leaveRequests, setLeaveRequests] = useState(/* ... */);

  const grouped = useMemo(() => {
    return filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date",
      "date-asc"
    );
  }, [leaveRequests, filters]);

  return (
    <>
      <FilterPanel
        leaveRequests={leaveRequests}
        onFilterChange={(f, c) => setFilters(f)}
      />
      <GroupedLeaveList groupedData={grouped} />
    </>
  );
}
```

## Grouping Options

Use different grouping dimensions:

```tsx
// Group by date
const grouped = groupLeaveRequests(requests, "date", "date-asc");

// Group by status
const grouped = groupLeaveRequests(requests, "status", "name");

// Group by employee
const grouped = groupLeaveRequests(requests, "employee", "date-desc");

// Group by department
const grouped = groupLeaveRequests(requests, "department", "name");
```

## Styling

The component uses Tailwind CSS and follows your design system:

- **Sticky Headers**: `sticky top-0` with backdrop blur
- **Grid Layout**: Responsive grid (1-3 columns)
- **Spacing**: Consistent gaps using `VStack` and `HStack`
- **Transitions**: Smooth expand/collapse animations
- **Colors**: Semantic color classes for different states

## Performance Considerations

- **Virtual Scrolling**: Enabled automatically for sections with 20+ items
- **Memoization**: Uses `useMemo` for expensive calculations
- **Efficient Rendering**: Only renders visible items in virtualized sections
- **Scroll Optimization**: Debounced scroll handling

## Accessibility

- ✅ Proper semantic HTML
- ✅ Keyboard navigation support
- ✅ ARIA attributes (`aria-expanded`)
- ✅ Focus indicators
- ✅ Screen reader friendly

## Related Components

- `LeaveRequestCard` - Individual leave request cards
- `FilterPanel` - Filter leave requests
- `utils/leave-requests.ts` - Grouping utilities
- `utils/leave-request-filters.ts` - Filter utilities











