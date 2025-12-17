# DateRangePresets Component

A comprehensive date range picker component with quick presets, custom date selection, relative date search, and calendar visualization with leave request indicators.

## Features

- ✅ **Quick Preset Buttons**: Today, Tomorrow, This Week, This Month, Last 7 Days, Last 30 Days, Custom
- ✅ **Custom Date Picker**: Start and end date inputs with validation (end date must be after start date)
- ✅ **Clear Range Display**: Shows selected range in readable format (e.g., "Dec 8 - Dec 14, 2025")
- ✅ **Relative Date Search**: Supports natural language queries like "last 3 days", "next 7 days", "last week", "last month"
- ✅ **Calendar Integration**: Visual calendar view showing leave requests within selected range
- ✅ **Leave Request Indicators**: Visual indicators on calendar showing leaves within selected range
- ✅ **Date Range Validation**: Ensures end date is after start date
- ✅ **TypeScript Support**: Full type safety with exported interfaces
- ✅ **Returns Date Range**: Returns `{ startDate, endDate }` for filtering logic

## Installation

The component uses the following dependencies (already installed):

- `date-fns` - For date manipulation and formatting
- `@radix-ui/react-dialog` - For calendar modal
- `phosphor-react` - For icons

## Basic Usage

```tsx
import {
  DateRangePresets,
  type DateRange,
} from "@/components/DateRangePresets";

function MyComponent() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    // Use range.startDate and range.endDate for filtering
    console.log("Filtering from", range.startDate, "to", range.endDate);
  };

  return (
    <DateRangePresets
      onChange={handleDateRangeChange}
      initialRange={dateRange}
    />
  );
}
```

## Props

### DateRangePresetsProps

| Prop                  | Type                         | Default                              | Description                           |
| --------------------- | ---------------------------- | ------------------------------------ | ------------------------------------- |
| `onChange`            | `(range: DateRange) => void` | -                                    | Callback when date range changes      |
| `initialRange`        | `DateRange`                  | `{ startDate: null, endDate: null }` | Initial date range                    |
| `leaveRequests`       | `LeaveRequestForCalendar[]`  | `[]`                                 | Leave requests to display on calendar |
| `showCalendar`        | `boolean`                    | `true`                               | Whether to show the calendar view     |
| `className`           | `string`                     | -                                    | Custom className                      |
| `allowRelativeSearch` | `boolean`                    | `true`                               | Whether to allow relative date search |

### DateRange Interface

```tsx
interface DateRange {
  startDate: string | null; // ISO date string (yyyy-MM-dd)
  endDate: string | null; // ISO date string (yyyy-MM-dd)
}
```

### LeaveRequestForCalendar Interface

```tsx
interface LeaveRequestForCalendar {
  id: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  leaveType: string;
  status?: string;
  employeeName?: string;
}
```

## Examples

### With Leave Requests

```tsx
import { DateRangePresets } from "@/components/DateRangePresets";

function LeaveApprovalPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  // Fetch leave requests
  useEffect(() => {
    // ... fetch logic
  }, []);

  // Filter leave requests by date range
  const filteredLeaves = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return leaveRequests;
    }

    return leaveRequests.filter((leave) => {
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date);
      const rangeStart = new Date(dateRange.startDate!);
      const rangeEnd = new Date(dateRange.endDate!);

      // Check if leave overlaps with range
      return (
        (leaveStart >= rangeStart && leaveStart <= rangeEnd) ||
        (leaveEnd >= rangeStart && leaveEnd <= rangeEnd) ||
        (leaveStart <= rangeStart && leaveEnd >= rangeEnd)
      );
    });
  }, [leaveRequests, dateRange]);

  return (
    <div>
      <DateRangePresets
        onChange={setDateRange}
        leaveRequests={leaveRequests.map((leave) => ({
          id: leave.id,
          startDate: leave.start_date,
          endDate: leave.end_date,
          leaveType: leave.leave_type,
          status: leave.status,
          employeeName: leave.employee_name,
        }))}
      />

      {/* Display filtered leaves */}
      {filteredLeaves.map((leave) => (
        <LeaveCard key={leave.id} leave={leave} />
      ))}
    </div>
  );
}
```

### Integration with FilterPanel

```tsx
import { DateRangePresets } from "@/components/DateRangePresets";
import { FilterPanel, applyFilters } from "@/components/FilterPanel";

function LeaveRequestPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [filters, setFilters] = useState<LeaveRequestFilterConfig>({
    dateRange: { preset: null, startDate: null, endDate: null },
    status: [],
    leaveType: [],
    employeeIds: [],
    departments: [],
    approvalStage: [],
  });

  // Sync DateRangePresets with FilterPanel
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    setFilters((prev) => ({
      ...prev,
      dateRange: {
        preset: range.startDate && range.endDate ? "custom" : null,
        startDate: range.startDate,
        endDate: range.endDate,
      },
    }));
  };

  // Apply filters
  const filteredRequests = useMemo(() => {
    return applyFilters(leaveRequests, filters);
  }, [leaveRequests, filters]);

  return (
    <div>
      <DateRangePresets
        onChange={handleDateRangeChange}
        initialRange={dateRange}
        leaveRequests={leaveRequests.map((r) => ({
          id: r.id,
          startDate: r.startDate,
          endDate: r.endDate,
          leaveType: r.leaveType,
          status: r.status,
        }))}
      />

      <FilterPanel
        leaveRequests={leaveRequests}
        onFilterChange={(newFilters) => setFilters(newFilters)}
      />
    </div>
  );
}
```

### Relative Date Search Examples

The component supports natural language date queries:

- `"last 3 days"` - Last 3 days including today
- `"next 7 days"` - Next 7 days starting from today
- `"last week"` - Last week (Monday to Sunday)
- `"last month"` - Last month (first to last day)
- `"past 30 days"` - Past 30 days including today

```tsx
<DateRangePresets onChange={handleDateRangeChange} allowRelativeSearch={true} />
```

## Date Format

All dates are returned in ISO format (`yyyy-MM-dd`):

```tsx
{
  startDate: "2025-12-08",
  endDate: "2025-12-14"
}
```

## Display Format

The component displays dates in a human-readable format:

- Single day: `"Dec 8, 2025"`
- Same month: `"Dec 8 - 14, 2025"`
- Same year: `"Dec 8 - Jan 5, 2025"`
- Different years: `"Dec 8, 2024 - Jan 5, 2025"`

## Calendar Features

### Visual Indicators

- **Selected Range**: Highlighted in primary color
- **Start/End Dates**: Bold with primary background
- **Today**: Ring border
- **Leave Requests**: Colored badges showing leave type

### Leave Type Colors

- **SIL**: Blue
- **LWOP**: Gray
- **Maternity Leave**: Purple
- **Paternity Leave**: Cyan
- **Off-setting**: Amber
- **Other**: Emerald

### Calendar Navigation

- Click previous/next month buttons to navigate
- Click on a day to start selecting a range
- Click another day to complete the range
- If end date is before start date, they are automatically swapped

## Validation

The component validates:

- End date must be after start date
- Dates must be valid ISO format
- Relative date queries must be between 1-365 days

## Styling

The component uses Tailwind CSS and follows the project's design system. You can customize styling using the `className` prop:

```tsx
<DateRangePresets
  className="my-custom-class"
  onChange={handleDateRangeChange}
/>
```

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus indicators on interactive elements
- Semantic HTML structure

## Performance

- Memoized calendar calculations
- Efficient leave request mapping
- Debounced relative search (if needed)

## Notes

- Dates are handled in the user's local timezone
- The calendar shows a full month view with previous/next month days visible
- Leave requests are expanded to show all days in their range
- The component is fully controlled - use `initialRange` prop to set initial state
