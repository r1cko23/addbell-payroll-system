# FilterPanel Component

A comprehensive, reusable filter panel component for leave requests with multiple filter dimensions, real-time preview, and persistent state management.

## Features

- ✅ **Multiple Filter Dimensions**: Date range, status, leave type, employee, department, and approval stage
- ✅ **Multiple Selections**: Checkboxes for multi-select filters
- ✅ **Date Presets**: Quick filters for Today, This Week, This Month, Last 7/30 Days, and Custom Range
- ✅ **Searchable Dropdowns**: Employee filter with search functionality
- ✅ **Real-time Preview**: Shows count of matching records as filters change
- ✅ **Preset Buttons**: Quick filter presets (Show Pending, Show Overdue, etc.)
- ✅ **Persistent State**: Automatically saves filter state to sessionStorage
- ✅ **Mobile Responsive**: Responsive grid layouts that adapt to screen size
- ✅ **TypeScript Support**: Full type safety with exported interfaces
- ✅ **Clear All**: One-click button to reset all filters

## Installation

The component uses the following dependencies (already installed):

- `@radix-ui/react-checkbox` - For checkbox inputs
- `@radix-ui/react-select` - For dropdown selects
- `date-fns` - For date manipulation
- `phosphor-react` - For icons

## Basic Usage

```tsx
import {
  FilterPanel,
  type LeaveRequestFilterConfig,
} from "@/components/FilterPanel";

function LeaveRequestPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filters, setFilters] = useState<LeaveRequestFilterConfig>({
    dateRange: { preset: null, startDate: null, endDate: null },
    status: [],
    leaveType: [],
    employeeIds: [],
    departments: [],
    approvalStage: [],
  });

  const handleFilterChange = (
    newFilters: LeaveRequestFilterConfig,
    filteredCount: number
  ) => {
    setFilters(newFilters);
    // Apply filters to your data
  };

  return (
    <FilterPanel
      leaveRequests={leaveRequests}
      onFilterChange={handleFilterChange}
      showPreview={true}
    />
  );
}
```

## Props

### FilterPanelProps

| Prop             | Type                       | Default                 | Description                           |
| ---------------- | -------------------------- | ----------------------- | ------------------------------------- |
| `leaveRequests`  | `Array<LeaveRequest>`      | **required**            | Array of leave requests to filter     |
| `filterOptions`  | `FilterOptions`            | `{}`                    | Pre-defined filter options (optional) |
| `onFilterChange` | `(filters, count) => void` | `undefined`             | Callback when filters change          |
| `storageKey`     | `string`                   | `"leaveRequestFilters"` | Key for sessionStorage persistence    |
| `showPreview`    | `boolean`                  | `true`                  | Show filtered count preview           |
| `className`      | `string`                   | `undefined`             | Custom CSS classes                    |

### LeaveRequest Interface

```typescript
interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
  status: string;
  leaveType: string;
  department?: string;
  approvedByManager?: boolean;
  approvedByHR?: boolean;
}
```

### LeaveRequestFilterConfig Interface

```typescript
interface LeaveRequestFilterConfig {
  dateRange: {
    preset?:
      | "today"
      | "thisWeek"
      | "thisMonth"
      | "last7Days"
      | "last30Days"
      | "custom"
      | null;
    startDate?: string | null; // ISO date string
    endDate?: string | null; // ISO date string
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
```

## Filter Dimensions

### 1. Date Range Filter

Supports multiple presets and custom date ranges:

- **Today**: Filters requests starting today
- **This Week**: Current week (Monday-Sunday)
- **This Month**: Current month
- **Last 7 Days**: Past 7 days from today
- **Last 30 Days**: Past 30 days from today
- **Custom Range**: Manual start/end date selection

```tsx
// Date range is automatically set when a preset is selected
// Custom range allows manual date input
```

### 2. Status Filter

Multi-select checkboxes for leave request statuses:

- Automatically extracts unique statuses from `leaveRequests`
- Or use `filterOptions.statuses` to pre-define options

### 3. Leave Type Filter

Multi-select checkboxes for leave types:

- Automatically extracts unique leave types from `leaveRequests`
- Or use `filterOptions.leaveTypes` to pre-define options

### 4. Employee Filter

Searchable multi-select dropdown:

- Search by employee name or ID
- Shows employee name and ID
- Automatically extracts from `leaveRequests`
- Or use `filterOptions.employees` to pre-define options

### 5. Department Filter

Multi-select checkboxes for departments:

- Automatically extracts unique departments from `leaveRequests`
- Or use `filterOptions.departments` to pre-define options

### 6. Approval Stage Filter

Multi-select checkboxes for approval stages:

- **Pending**: Requests with status "pending"
- **Manager Approved**: Requests approved by manager but not HR
- **HR Approved**: Requests approved by HR
- **Rejected**: Requests with status "rejected"

## Preset Filters

Quick filter buttons for common scenarios:

```tsx
// Available presets:
- "Show Pending" - Shows only pending requests
- "Show Overdue" - Shows requests with start date in the past
- "This Week" - Shows requests in current week
- "This Month" - Shows requests in current month
- "Approved" - Shows HR-approved requests
- "Rejected" - Shows rejected requests
```

## Integration with Grouping Utility

Use the `filterAndGroupLeaveRequests` utility to combine filtering and grouping:

```tsx
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";
import { type LeaveRequestFilterConfig } from "@/components/FilterPanel";

const { groups } = filterAndGroupLeaveRequests(
  leaveRequests,
  filters,
  "date", // groupBy
  "date-asc" // sortBy
);
```

## State Persistence

Filters are automatically saved to `sessionStorage` using the provided `storageKey`. The state persists across page refreshes within the same browser session.

```tsx
// Custom storage key
<FilterPanel
  storageKey="myCustomFilters"
  // ...
/>
```

## Filter Options

Pre-define available filter options to improve performance and UX:

```tsx
<FilterPanel
  leaveRequests={leaveRequests}
  filterOptions={{
    statuses: ["pending", "approved_by_manager", "approved_by_hr", "rejected"],
    leaveTypes: ["SIL", "LWOP", "Maternity Leave"],
    employees: [
      { id: "EMP001", name: "John Doe" },
      { id: "EMP002", name: "Jane Smith" },
    ],
    departments: ["Engineering", "Sales", "HR"],
  }}
/>
```

## Complete Example

```tsx
"use client";

import { useState, useMemo } from "react";
import {
  FilterPanel,
  type LeaveRequestFilterConfig,
} from "@/components/FilterPanel";
import { filterAndGroupLeaveRequests } from "@/utils/leave-request-filters";
import { transformDbLeaveRequest } from "@/utils/leave-requests";

export default function LeaveRequestPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filters, setFilters] = useState<LeaveRequestFilterConfig>({
    dateRange: { preset: null, startDate: null, endDate: null },
    status: [],
    leaveType: [],
    employeeIds: [],
    departments: [],
    approvalStage: [],
  });

  // Apply filters and group
  const { grouped, filteredCount } = useMemo(() => {
    const result = filterAndGroupLeaveRequests(
      leaveRequests,
      filters,
      "date",
      "date-asc"
    );
    return {
      grouped: result,
      filteredCount: result.groups.reduce((sum, g) => sum + g.count, 0),
    };
  }, [leaveRequests, filters]);

  const handleFilterChange = (
    newFilters: LeaveRequestFilterConfig,
    count: number
  ) => {
    setFilters(newFilters);
  };

  return (
    <div>
      <FilterPanel
        leaveRequests={leaveRequests}
        onFilterChange={handleFilterChange}
        showPreview={true}
      />

      {/* Render filtered and grouped results */}
      {grouped.groups.map((group) => (
        <div key={group.key}>
          <h2>
            {group.label} ({group.count})
          </h2>
          {group.items.map((request) => (
            <div key={request.id}>
              {request.employeeName} - {request.startDate}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Mobile Responsiveness

The component is fully responsive:

- **Grid Layouts**: Automatically adjusts columns based on screen size

  - Mobile: 1-2 columns
  - Tablet: 2-3 columns
  - Desktop: 3-4 columns

- **Collapsible Panel**: Can be expanded/collapsed to save space
- **Touch-Friendly**: Large touch targets for mobile devices
- **Scrollable Sections**: Long lists (employees) are scrollable

## Styling

The component uses Tailwind CSS and follows your design system:

- Uses existing UI components (`Card`, `Button`, `Input`, etc.)
- Consistent spacing with `VStack` and `HStack`
- Responsive breakpoints: `sm:`, `md:`, `lg:`
- Hover states and transitions
- Focus states for accessibility

## Accessibility

- ✅ Proper label associations
- ✅ Keyboard navigation support
- ✅ ARIA attributes where needed
- ✅ Focus indicators
- ✅ Screen reader friendly

## Performance Considerations

- Uses `useMemo` for expensive computations
- Filters are applied efficiently
- Search is debounced implicitly through React state
- Large lists are virtualized through scrollable containers

## Troubleshooting

### Filters not persisting

Ensure `sessionStorage` is available (not in SSR context):

```tsx
// Component must be client-side
"use client";
```

### Filter options not showing

Ensure `leaveRequests` array is populated before rendering:

```tsx
{
  leaveRequests.length > 0 && <FilterPanel leaveRequests={leaveRequests} />;
}
```

### Date filter not working

Ensure dates are in ISO format (YYYY-MM-DD):

```tsx
startDate: "2024-01-15"; // ✅ Correct
startDate: "01/15/2024"; // ❌ Wrong
```

## Related Utilities

- `utils/leave-requests.ts` - Grouping and sorting utilities
- `utils/leave-request-filters.ts` - Filter application utilities
- `components/FilterPanel.example.tsx` - Usage examples











