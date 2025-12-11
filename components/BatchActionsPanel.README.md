# BatchActionsPanel Component

A sticky bottom panel component for handling bulk actions on multiple leave requests with checkbox selection, confirmation dialogs, and permission-based action controls.

## Features

- ✅ **Checkbox Selection**: Each LeaveRequestCard can have a checkbox for selection
- ✅ **Selection Counter**: Header shows "X selected" badge
- ✅ **Bulk Action Buttons**: Approve All, Reject All, Change Status, Export
- ✅ **Confirmation Dialogs**: Shows confirmation before bulk actions with affected items list
- ✅ **Affected Items Display**: Shows which leave requests will be affected
- ✅ **Disabled State**: Actions disabled when no selection
- ✅ **Persistent Selection**: Selections remembered while scrolling through filtered list
- ✅ **Sticky Positioning**: Panel sticks to bottom of viewport for easy access
- ✅ **Permission-Based**: Actions shown/hidden based on user role
- ✅ **TypeScript Support**: Full type safety with exported interfaces

## Installation

The component uses the following dependencies (already installed):

- `@radix-ui/react-alert-dialog` - For confirmation dialogs
- `@radix-ui/react-select` - For status change dropdown
- `phosphor-react` - For icons

## Basic Usage

```tsx
import { BatchActionsPanel } from "@/components/BatchActionsPanel";
import { LeaveRequestCard } from "@/components/LeaveRequestCard";
import { useSelectionState } from "@/hooks/useSelectionState";

function LeaveApprovalPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);

  // Use selection hook
  const { selectedIds, toggleSelection, clearSelection, isSelected } =
    useSelectionState(leaveRequests);

  const handleBulkApprove = async (ids: string[]) => {
    // Implement bulk approve logic
    console.log("Approving:", ids);
  };

  const handleBulkReject = async (ids: string[]) => {
    // Implement bulk reject logic
    console.log("Rejecting:", ids);
  };

  return (
    <div>
      {/* Leave Request Cards */}
      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      {/* Batch Actions Panel */}
      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onSelectionChange={(ids) => {
          // Update selection state
        }}
        onBulkApprove={handleBulkApprove}
        onBulkReject={handleBulkReject}
        userRole="hr"
      />
    </div>
  );
}
```

## Props

### BatchActionsPanelProps

| Prop                 | Type                                                 | Default | Description                                        |
| -------------------- | ---------------------------------------------------- | ------- | -------------------------------------------------- |
| `selectedIds`        | `Set<string>`                                        | -       | Set of selected leave request IDs                  |
| `leaveRequests`      | `LeaveRequestCardData[]`                             | -       | All leave requests (for displaying affected items) |
| `onSelectionChange`  | `(selectedIds: Set<string>) => void`                 | -       | Callback when selection changes                    |
| `onBulkApprove`      | `(ids: string[]) => void`                            | -       | Callback when bulk approve is triggered            |
| `onBulkReject`       | `(ids: string[]) => void`                            | -       | Callback when bulk reject is triggered             |
| `onBulkStatusChange` | `(ids: string[], newStatus: string) => void`         | -       | Callback when bulk status change is triggered      |
| `onExport`           | `(ids: string[]) => void`                            | -       | Callback when export is triggered                  |
| `userRole`           | `"account_manager" \| "hr" \| "admin" \| "employee"` | -       | Current user role for permission checks            |
| `showWhenEmpty`      | `boolean`                                            | `false` | Whether to show panel when no selection            |
| `className`          | `string`                                             | -       | Custom className                                   |

## useSelectionState Hook

The `useSelectionState` hook manages selection state that persists across filtering:

```tsx
import { useSelectionState } from "@/hooks/useSelectionState";

const {
  selectedIds, // Set<string> - Selected IDs
  selectedItems, // T[] - Selected items
  toggleSelection, // (id: string) => void
  selectAll, // () => void
  clearSelection, // () => void
  toggleSelectAll, // () => void
  isSelected, // (id: string) => boolean
  allSelected, // boolean
  someSelected, // boolean
  setSelectedIds, // (ids: Set<string>) => void
} = useSelectionState(leaveRequests);
```

## Examples

### Full Integration Example

```tsx
import { useState } from "react";
import { BatchActionsPanel } from "@/components/BatchActionsPanel";
import { LeaveRequestCard } from "@/components/LeaveRequestCard";
import { useSelectionState } from "@/hooks/useSelectionState";
import type { LeaveRequestCardData } from "@/components/LeaveRequestCard";

function LeaveApprovalPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestCardData[]>(
    []
  );
  const [userRole, setUserRole] = useState<"hr" | "account_manager" | "admin">(
    "hr"
  );

  // Selection state
  const {
    selectedIds,
    toggleSelection,
    clearSelection,
    isSelected,
    allSelected,
    toggleSelectAll,
  } = useSelectionState(leaveRequests);

  // Bulk approve handler
  const handleBulkApprove = async (ids: string[]) => {
    try {
      // Your API call here
      await approveLeaveRequests(ids);
      toast.success(`Approved ${ids.length} leave requests`);
      clearSelection();
      // Refresh data
      fetchLeaveRequests();
    } catch (error) {
      toast.error("Failed to approve requests");
    }
  };

  // Bulk reject handler
  const handleBulkReject = async (ids: string[]) => {
    try {
      await rejectLeaveRequests(ids);
      toast.success(`Rejected ${ids.length} leave requests`);
      clearSelection();
      fetchLeaveRequests();
    } catch (error) {
      toast.error("Failed to reject requests");
    }
  };

  // Bulk status change handler
  const handleBulkStatusChange = async (ids: string[], newStatus: string) => {
    try {
      await updateLeaveRequestStatus(ids, newStatus);
      toast.success(`Updated ${ids.length} leave requests`);
      clearSelection();
      fetchLeaveRequests();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Export handler
  const handleExport = async (ids: string[]) => {
    const selected = leaveRequests.filter((req) => ids.includes(req.id));
    // Export to CSV/JSON
    exportToCSV(selected);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Select All Header */}
      <div className="flex items-center justify-between">
        <h2>Leave Requests</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
          />
          <span>Select All</span>
        </label>
      </div>

      {/* Leave Request Cards */}
      {leaveRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          userRole={userRole}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
          onApprove={(id, level) => {
            handleBulkApprove([id]);
          }}
          onReject={(id) => {
            handleBulkReject([id]);
          }}
        />
      ))}

      {/* Batch Actions Panel */}
      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={leaveRequests}
        onSelectionChange={(ids) => {
          // Selection managed by hook, but you can sync here if needed
        }}
        onBulkApprove={handleBulkApprove}
        onBulkReject={handleBulkReject}
        onBulkStatusChange={handleBulkStatusChange}
        onExport={handleExport}
        userRole={userRole}
      />
    </div>
  );
}
```

### With Filtering

```tsx
function FilteredLeaveRequests() {
  const [allRequests, setAllRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [filters, setFilters] = useState({});

  // Selection persists across filtering
  const { selectedIds, toggleSelection, isSelected } =
    useSelectionState(allRequests); // Use allRequests, not filtered

  // Filter requests
  useEffect(() => {
    const filtered = applyFilters(allRequests, filters);
    setFilteredRequests(filtered);
  }, [allRequests, filters]);

  return (
    <div>
      {/* Filter UI */}
      <FilterPanel onFilterChange={setFilters} />

      {/* Filtered Cards */}
      {filteredRequests.map((request) => (
        <LeaveRequestCard
          key={request.id}
          request={request}
          showCheckbox={true}
          isSelected={isSelected(request.id)}
          onSelectionToggle={toggleSelection}
        />
      ))}

      {/* Panel shows all selected, even if filtered out */}
      <BatchActionsPanel
        selectedIds={selectedIds}
        leaveRequests={allRequests} // Use allRequests for summary
        onBulkApprove={handleBulkApprove}
        userRole="hr"
      />
    </div>
  );
}
```

## Permission-Based Actions

Actions are automatically shown/hidden based on user role:

- **Account Manager**: Can approve/reject pending requests
- **HR/Admin**: Can approve/reject manager-approved requests, change status
- **Employee**: No bulk actions available

## Confirmation Dialogs

Each bulk action shows a confirmation dialog with:

- Count of affected requests
- Sample list of affected requests (first 5)
- Status/type breakdown
- Action-specific details

## Sticky Positioning

The panel is positioned at the bottom of the viewport using `sticky bottom-0`. Make sure to add padding to your content container:

```tsx
<div className="pb-24">
  {" "}
  {/* Space for sticky panel */}
  {/* Your content */}
</div>
```

## Export Functionality

The export dialog supports:

- CSV format (Excel compatible)
- JSON format (Data export)
- Shows preview of what will be exported

## Notes

- Selections persist across filtering/scrolling
- Panel auto-hides when no selection (unless `showWhenEmpty={true}`)
- Actions are disabled when no selection
- Confirmation dialogs prevent accidental bulk actions
- Selection state is managed independently from filtered list
