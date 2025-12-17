# Leave Request Grouping Utility

A comprehensive utility module for grouping and sorting leave requests by multiple dimensions with intelligent date categorization.

## Features

- **Multi-dimensional grouping**: Group by date, status, employee, or department
- **Flexible sorting**: Sort by date (ascending/descending), name, or status
- **Intelligent date bucketing**: Automatically categorizes dates into Today, This Week, This Month, Overdue, and Upcoming
- **Type-safe**: Full TypeScript support with exported interfaces
- **Database integration**: Helper function to transform database results to utility format

## Installation

The utility uses `date-fns` which is already installed in the project. No additional dependencies required.

## Usage

### Basic Example

```typescript
import { groupLeaveRequests } from "@/utils/leave-requests";

const requests: LeaveRequest[] = [
  {
    id: "1",
    employeeName: "John Doe",
    employeeId: "EMP001",
    startDate: "2024-01-15",
    endDate: "2024-01-17",
    status: "pending",
    leaveType: "SIL",
  },
  // ... more requests
];

// Group by date, sorted by date ascending
const grouped = groupLeaveRequests(requests, "date", "date-asc");

// Render the grouped data
grouped.groups.forEach((group) => {
  console.log(`${group.label}: ${group.count} requests`);
  group.items.forEach((request) => {
    console.log(`  - ${request.employeeName}: ${request.startDate}`);
  });
});
```

### Grouping Options

#### Group by Date

Groups requests into intelligent date buckets:

- **Overdue**: Past dates (excluding today)
- **Today**: Requests starting today
- **This Week**: Requests in the current week (Monday-Sunday)
- **This Month**: Requests in the current month
- **Upcoming**: Future dates beyond current month

```typescript
const grouped = groupLeaveRequests(requests, "date", "date-asc");
```

#### Group by Status

Groups requests by their approval status:

- pending
- approved_by_manager
- approved_by_hr
- rejected
- cancelled

```typescript
const grouped = groupLeaveRequests(requests, "status", "name");
```

#### Group by Employee

Groups all requests by employee ID:

```typescript
const grouped = groupLeaveRequests(requests, "employee", "date-desc");
```

#### Group by Department

Groups requests by department (requires `department` field):

```typescript
const grouped = groupLeaveRequests(requests, "department", "name");
```

### Sorting Options

- **`date-asc`**: Sort by start date, earliest first
- **`date-desc`**: Sort by start date, latest first
- **`name`**: Sort alphabetically by employee name
- **`status`**: Sort by status priority (pending → approved_by_manager → approved_by_hr → rejected → cancelled)

### Transforming Database Results

When working with Supabase queries that return snake_case properties:

```typescript
import {
  transformDbLeaveRequest,
  groupLeaveRequests,
} from "@/utils/leave-requests";

// After fetching from Supabase
const { data } = await supabase.from("leave_requests").select(`
    *,
    employees (full_name, department)
  `);

// Transform each result
const transformedRequests = data.map((dbRequest) =>
  transformDbLeaveRequest(
    dbRequest,
    dbRequest.employees.full_name,
    dbRequest.employees.department
  )
);

// Now group and sort
const grouped = groupLeaveRequests(transformedRequests, "date", "date-asc");
```

### Helper Functions

#### Get Date Bucket

Determine which date category a request falls into:

```typescript
import { getDateBucket } from "@/utils/leave-requests";

const bucket = getDateBucket("2024-01-15");
// Returns: 'Today' | 'This Week' | 'This Month' | 'Overdue' | 'Upcoming'
```

#### Format Date Range

Format start and end dates for display:

```typescript
import { formatDateRange } from "@/utils/leave-requests";

const formatted = formatDateRange("2024-01-15", "2024-01-17");
// Returns: "Jan 15 - Jan 17, 2024"
// Or: "Jan 15, 2024" if same day
```

#### Check if Overdue

Check if a leave request is overdue:

```typescript
import { isLeaveRequestOverdue } from "@/utils/leave-requests";

const overdue = isLeaveRequestOverdue("2024-01-10");
// Returns: true if date is in the past (excluding today)
```

#### Get Days Until Leave

Calculate days until leave starts:

```typescript
import { getDaysUntilLeave } from "@/utils/leave-requests";

const days = getDaysUntilLeave("2024-01-20");
// Returns: positive number for future dates, negative for past dates
```

## Type Definitions

### LeaveRequest Interface

```typescript
interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  status:
    | "pending"
    | "approved_by_manager"
    | "approved_by_hr"
    | "rejected"
    | "cancelled";
  leaveType: string;
  approvedByManager?: boolean;
  approvedByHR?: boolean;
  department?: string; // Required for 'department' grouping
}
```

### Return Type

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

## React Component Example

```typescript
"use client";

import { groupLeaveRequests, formatDateRange } from "@/utils/leave-requests";
import { LeaveRequest } from "@/utils/leave-requests";

export function LeaveRequestList({ requests }: { requests: LeaveRequest[] }) {
  const grouped = groupLeaveRequests(requests, "date", "date-asc");

  return (
    <div>
      {grouped.groups.map((group) => (
        <div key={group.key} className="mb-8">
          <h2 className="text-xl font-bold mb-4">
            {group.label} ({group.count})
          </h2>
          <div className="space-y-2">
            {group.items.map((request) => (
              <div key={request.id} className="p-4 border rounded">
                <div className="font-semibold">{request.employeeName}</div>
                <div className="text-sm text-gray-600">
                  {formatDateRange(request.startDate, request.endDate)}
                </div>
                <div className="text-sm">
                  Status: {request.status} | Type: {request.leaveType}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Notes

- Date bucketing uses Monday as the start of the week
- All dates should be in ISO format (YYYY-MM-DD)
- The utility handles missing department fields gracefully (groups as 'Unassigned')
- Groups are automatically sorted in a logical order (e.g., Overdue → Today → This Week → This Month → Upcoming)











