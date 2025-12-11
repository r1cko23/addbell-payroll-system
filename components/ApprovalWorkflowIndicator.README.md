# ApprovalWorkflowIndicator Component

A visual timeline/stepper component that displays the approval workflow progress for leave requests, showing each stage with status indicators, timestamps, approver information, and comments.

## Features

- ✅ **Linear Progress Timeline**: Visual stepper showing Pending → Manager Review → HR Review → Approved/Rejected
- ✅ **Current Stage Highlighting**: Active stage is visually highlighted with ring indicator
- ✅ **Timestamps**: Shows approval timestamps for each completed stage
- ✅ **Approver Information**: Displays who approved at each stage (Manager name, HR name)
- ✅ **Comments/Notes**: Shows approver notes and comments for each stage
- ✅ **Visual Status Indicators**: Color-coded based on final status (In Progress, Completed, Rejected)
- ✅ **Rejection Handling**: Special display for rejected requests with rejection reason
- ✅ **Cancellation Support**: Handles cancelled requests appropriately
- ✅ **TypeScript Support**: Full type safety with exported interfaces

## Installation

The component uses the following dependencies (already installed):

- `date-fns` - For date formatting
- `phosphor-react` - For icons

## Basic Usage

```tsx
import { ApprovalWorkflowIndicator } from "@/components/ApprovalWorkflowIndicator";

function LeaveRequestDetails() {
  const leaveRequest = {
    status: "approved_by_hr",
    managerApproval: {
      approverId: "user-123",
      approverName: "John Manager",
      approvedAt: "2025-12-10T10:30:00Z",
      notes: "Approved. Employee has sufficient credits.",
    },
    hrApproval: {
      approverId: "user-456",
      approverName: "Jane HR",
      approvedAt: "2025-12-11T14:20:00Z",
      notes: "Final approval granted.",
    },
    createdAt: "2025-12-09T08:00:00Z",
  };

  return (
    <ApprovalWorkflowIndicator
      status={leaveRequest.status}
      managerApproval={leaveRequest.managerApproval}
      hrApproval={leaveRequest.hrApproval}
      createdAt={leaveRequest.createdAt}
    />
  );
}
```

## Props

### ApprovalWorkflowIndicatorProps

| Prop              | Type                                                                                  | Default | Description                                              |
| ----------------- | ------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| `status`          | `"pending" \| "approved_by_manager" \| "approved_by_hr" \| "rejected" \| "cancelled"` | -       | Current status of the leave request                      |
| `managerApproval` | `ApprovalInfo`                                                                        | -       | Manager approval information                             |
| `hrApproval`      | `ApprovalInfo`                                                                        | -       | HR approval information                                  |
| `rejection`       | `{ rejectedBy?, rejectedAt?, rejectionReason? }`                                      | -       | Rejection information (if rejected)                      |
| `createdAt`       | `string \| null`                                                                      | -       | Request creation timestamp                               |
| `showDetails`     | `boolean`                                                                             | `true`  | Whether to show detailed information (notes, timestamps) |
| `className`       | `string`                                                                              | -       | Custom className                                         |

### ApprovalInfo Interface

```tsx
interface ApprovalInfo {
  approverId?: string | null;
  approverName?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
}
```

## Examples

### Pending Request

```tsx
<ApprovalWorkflowIndicator status="pending" createdAt="2025-12-10T08:00:00Z" />
```

### Manager Approved

```tsx
<ApprovalWorkflowIndicator
  status="approved_by_manager"
  managerApproval={{
    approverId: "user-123",
    approverName: "John Manager",
    approvedAt: "2025-12-10T10:30:00Z",
    notes: "Approved. Employee has sufficient credits.",
  }}
  createdAt="2025-12-10T08:00:00Z"
/>
```

### Fully Approved

```tsx
<ApprovalWorkflowIndicator
  status="approved_by_hr"
  managerApproval={{
    approverId: "user-123",
    approverName: "John Manager",
    approvedAt: "2025-12-10T10:30:00Z",
    notes: "Approved.",
  }}
  hrApproval={{
    approverId: "user-456",
    approverName: "Jane HR",
    approvedAt: "2025-12-11T14:20:00Z",
    notes: "Final approval granted.",
  }}
  createdAt="2025-12-10T08:00:00Z"
/>
```

### Rejected Request

```tsx
<ApprovalWorkflowIndicator
  status="rejected"
  rejection={{
    rejectedBy: "user-123",
    rejectedAt: "2025-12-10T10:30:00Z",
    rejectionReason: "Insufficient leave credits available.",
  }}
  createdAt="2025-12-10T08:00:00Z"
/>
```

### Integration with Leave Request Data

```tsx
import { ApprovalWorkflowIndicator } from "@/components/ApprovalWorkflowIndicator";

function LeaveRequestCard({ request }: { request: LeaveRequest }) {
  // Transform database structure to component props
  const managerApproval = request.account_manager_id
    ? {
        approverId: request.account_manager_id,
        approverName: request.account_manager_name, // From join
        approvedAt: request.account_manager_approved_at,
        notes: request.account_manager_notes,
      }
    : undefined;

  const hrApproval = request.hr_approved_by
    ? {
        approverId: request.hr_approved_by,
        approverName: request.hr_approver_name, // From join
        approvedAt: request.hr_approved_at,
        notes: request.hr_notes,
      }
    : undefined;

  const rejection =
    request.status === "rejected"
      ? {
          rejectedBy: request.rejected_by,
          rejectedAt: request.rejected_at,
          rejectionReason: request.rejection_reason,
        }
      : undefined;

  return (
    <div>
      {/* Other leave request details */}
      <ApprovalWorkflowIndicator
        status={request.status}
        managerApproval={managerApproval}
        hrApproval={hrApproval}
        rejection={rejection}
        createdAt={request.created_at}
      />
    </div>
  );
}
```

### Without Details

```tsx
<ApprovalWorkflowIndicator
  status="approved_by_hr"
  managerApproval={managerApproval}
  hrApproval={hrApproval}
  showDetails={false}
/>
```

## Workflow Stages

The component displays the following stages:

1. **Pending** - Initial state, awaiting manager review
2. **Manager Review** - Under manager review
3. **HR Review** - Under HR review (after manager approval)
4. **Approved** - Fully approved (after HR approval)

## Status Colors

- **Completed**: Primary color (blue/green)
- **In Progress**: Primary color with ring indicator
- **Pending**: Muted gray
- **Rejected**: Destructive red

## Visual Indicators

- **Circle Icons**: Each stage has a circular icon indicator
- **Connecting Lines**: Lines connect stages, colored based on completion
- **Badges**: Status badges show "Current", "Completed", or "Rejected"
- **Timestamps**: Formatted as "MMM dd, yyyy 'at' h:mm a"
- **Notes Box**: Approver notes displayed in a muted background box

## Data Transformation

When integrating with Supabase queries, you'll need to:

1. Join with `users` table to get approver names
2. Transform snake_case to camelCase
3. Handle null values appropriately

Example query:

```sql
SELECT
  lr.*,
  manager.full_name as account_manager_name,
  hr.full_name as hr_approver_name
FROM leave_requests lr
LEFT JOIN users manager ON manager.id = lr.account_manager_id
LEFT JOIN users hr ON hr.id = lr.hr_approved_by
WHERE lr.id = $1
```

## Styling

The component uses Tailwind CSS and follows the project's design system. You can customize styling using the `className` prop:

```tsx
<ApprovalWorkflowIndicator
  className="my-custom-class"
  status={status}
  // ... other props
/>
```

## Accessibility

- Semantic HTML structure
- Color contrast meets WCAG standards
- Clear visual hierarchy
- Descriptive labels and timestamps

## Notes

- Timestamps are formatted in the user's local timezone
- The component handles missing data gracefully (shows what's available)
- Rejected requests show only up to the manager review stage
- Cancelled requests display a special message
