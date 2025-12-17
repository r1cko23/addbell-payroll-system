# LeaveRequestCard Component

A visually scannable card component for displaying individual leave requests with all relevant information, context-aware actions, and hover effects.

## Features

- ✅ **Employee Avatar**: Initials badge with employee name
- ✅ **Color-Coded Leave Types**: Visual indicators (SIL=blue, LWOP=purple, Maternity=pink, etc.)
- ✅ **Clear Date Display**: Formatted date range with icons
- ✅ **Duration Calculation**: Automatic days/hours calculation
- ✅ **Status Indicators**: Visual badges for all statuses
- ✅ **Location Support**: Displays location/address if available
- ✅ **Context-Aware Actions**: Approve/Reject buttons based on user role and approval stage
- ✅ **Leave Balance**: Shows available credits/hours with warnings
- ✅ **Hover Effects**: Reveals additional information on hover
- ✅ **Overdue Indicator**: Visual indicator for overdue requests
- ✅ **Mobile Responsive**: Adapts to different screen sizes

## Installation

The component uses existing UI components and utilities:

- `@radix-ui/react-avatar` - For avatar display
- `date-fns` - For date calculations
- Existing UI components (`Card`, `Badge`, `Button`, etc.)

## Basic Usage

```tsx
import {
  LeaveRequestCard,
  type LeaveRequestCardData,
} from "@/components/LeaveRequestCard";

function LeaveRequestList() {
  const request: LeaveRequestCardData = {
    id: "1",
    employeeName: "John Doe",
    employeeId: "EMP001",
    startDate: "2024-01-15",
    endDate: "2024-01-17",
    status: "pending",
    leaveType: "SIL",
    totalDays: 3,
    reason: "Family emergency",
    department: "Engineering",
    availableCredits: 5,
  };

  return (
    <LeaveRequestCard
      request={request}
      onViewDetails={(id) => console.log("View:", id)}
    />
  );
}
```

## Props

### LeaveRequestCardProps

| Prop            | Type                                                 | Default      | Description                                 |
| --------------- | ---------------------------------------------------- | ------------ | ------------------------------------------- |
| `request`       | `LeaveRequestCardData`                               | **required** | Leave request data object                   |
| `userRole`      | `"account_manager" \| "hr" \| "admin" \| "employee"` | `undefined`  | Current user role for context-aware actions |
| `onApprove`     | `(id: string, level: "manager" \| "hr") => void`     | `undefined`  | Callback when approve button is clicked     |
| `onReject`      | `(id: string) => void`                               | `undefined`  | Callback when reject button is clicked      |
| `onViewDetails` | `(id: string) => void`                               | `undefined`  | Callback when view details is clicked       |
| `showActions`   | `boolean`                                            | `true`       | Whether to show action buttons              |
| `className`     | `string`                                             | `undefined`  | Custom CSS classes                          |
| `clickable`     | `boolean`                                            | `true`       | Whether card is clickable (opens details)   |

### LeaveRequestCardData Interface

```typescript
interface LeaveRequestCardData {
  id: string;
  employeeName: string;
  employeeId: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
  status:
    | "pending"
    | "approved_by_manager"
    | "approved_by_hr"
    | "rejected"
    | "cancelled";
  leaveType:
    | "SIL"
    | "LWOP"
    | "Maternity Leave"
    | "Paternity Leave"
    | "Off-setting";
  totalDays?: number;
  totalHours?: number;
  reason?: string | null;
  department?: string;
  location?: string;
  address?: string;
  approvedByManager?: boolean;
  approvedByHR?: boolean;
  // Leave balance
  availableCredits?: number; // For SIL
  availableOffsetHours?: number; // For Off-setting
  // Approval information
  approvedByManagerName?: string;
  approvedByHRName?: string;
  rejectedBy?: string;
  rejectionReason?: string | null;
}
```

## Leave Type Color Coding

| Leave Type      | Color   | Badge Color                       |
| --------------- | ------- | --------------------------------- |
| SIL             | Blue    | `bg-blue-100 text-blue-800`       |
| LWOP            | Purple  | `bg-purple-100 text-purple-800`   |
| Maternity Leave | Pink    | `bg-pink-100 text-pink-800`       |
| Paternity Leave | Cyan    | `bg-cyan-100 text-cyan-800`       |
| Off-setting     | Emerald | `bg-emerald-100 text-emerald-800` |

## Status Badges

| Status           | Badge Style | Color                    |
| ---------------- | ----------- | ------------------------ |
| Pending          | Secondary   | Yellow (`bg-yellow-100`) |
| Manager Approved | Default     | Blue (`bg-blue-100`)     |
| HR Approved      | Default     | Green (`bg-green-100`)   |
| Rejected         | Destructive | Red (`bg-red-100`)       |
| Cancelled        | Secondary   | Gray (`bg-gray-100`)     |

## Context-Aware Actions

The component automatically determines which actions to show based on:

1. **User Role**:

   - `account_manager`: Can approve/reject pending requests
   - `hr` or `admin`: Can approve/reject manager-approved requests
   - `employee`: No action buttons (view only)

2. **Request Status**:
   - `pending`: Shows approve/reject for managers
   - `approved_by_manager`: Shows approve/reject for HR
   - `approved_by_hr`: No actions (already approved)
   - `rejected`: No actions (already rejected)

### Action Button Logic

```tsx
// Account Manager sees:
- Pending requests: [Approve] [Reject] [View Details]
- Other statuses: [View Details]

// HR/Admin sees:
- Manager-approved requests: [Approve (HR)] [Reject] [View Details]
- Other statuses: [View Details]
```

## Leave Balance Display

The component shows leave balance when applicable:

### SIL Leave Balance

- Shows available credits
- Highlights in red if requested days exceed available credits
- Displays "(Insufficient)" warning

### Off-setting Balance

- Shows available offset hours
- Highlights in red if requested hours exceed available hours
- Displays "(Exceeds balance)" warning

## Hover Effects

On hover, the card:

- Elevates with shadow (`hover:shadow-lg`)
- Shows border highlight (`hover:border-primary/50`)
- Reveals full reason text (if hidden)
- Provides visual feedback for interactivity

## Overdue Indicator

Requests with start dates in the past (excluding today) show:

- Red left border (`border-l-4 border-l-red-500`)
- "Overdue" badge

## Complete Example

```tsx
"use client";

import {
  LeaveRequestCard,
  type LeaveRequestCardData,
} from "@/components/LeaveRequestCard";
import { useState } from "react";

export default function LeaveRequestPage() {
  const [requests, setRequests] = useState<LeaveRequestCardData[]>([]);

  const handleApprove = async (id: string, level: "manager" | "hr") => {
    // Your approval logic
    console.log("Approve:", id, level);
  };

  const handleReject = async (id: string) => {
    // Your rejection logic
    console.log("Reject:", id);
  };

  const handleViewDetails = (id: string) => {
    // Open details modal or navigate
    console.log("View:", id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {requests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          userRole="account_manager"
          showActions={true}
          onApprove={handleApprove}
          onReject={handleReject}
          onViewDetails={handleViewDetails}
        />
      ))}
    </div>
  );
}
```

## Integration with Supabase

Transform database results to card format:

```tsx
import { transformDbLeaveRequest } from "@/utils/leave-requests";

// After fetching from Supabase
const { data } = await supabase.from("leave_requests").select(`
    *,
    employees (full_name, department, sil_credits, offset_hours)
  `);

// Transform to card format
const cardData: LeaveRequestCardData = {
  id: data.id,
  employeeName: data.employees.full_name,
  employeeId: data.employee_id,
  startDate: data.start_date,
  endDate: data.end_date,
  status: data.status,
  leaveType: data.leave_type,
  totalDays: data.total_days,
  totalHours: data.total_hours,
  reason: data.reason,
  department: data.employees.department,
  availableCredits:
    data.leave_type === "SIL" ? data.employees.sil_credits : undefined,
  availableOffsetHours:
    data.leave_type === "Off-setting" ? data.employees.offset_hours : undefined,
  approvedByManager: !!data.account_manager_id,
  approvedByHR: !!data.hr_approver_id,
};
```

## Styling

The component uses Tailwind CSS and follows your design system:

- **Card**: Uses `Card` component with hover effects
- **Spacing**: Uses `VStack` and `HStack` for consistent spacing
- **Typography**: Uses `H4`, `BodySmall`, `Caption` components
- **Colors**: Semantic color classes for different states
- **Responsive**: Grid layouts adapt to screen size

## Accessibility

- ✅ Proper semantic HTML
- ✅ Keyboard navigation support
- ✅ ARIA labels where needed
- ✅ Focus indicators
- ✅ Screen reader friendly text

## Performance

- Uses `useState` for hover state (lightweight)
- No expensive calculations on render
- Efficient date formatting
- Optimized for large lists

## Related Components

- `FilterPanel` - Filter leave requests
- `utils/leave-requests.ts` - Grouping and sorting utilities
- `utils/leave-request-filters.ts` - Filter application utilities











