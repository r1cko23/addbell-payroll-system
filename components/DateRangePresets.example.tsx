/**
 * DateRangePresets Component Examples
 *
 * This file demonstrates various usage patterns for the DateRangePresets component.
 */

import { useState, useMemo } from "react";
import {
  DateRangePresets,
  type DateRange,
  type LeaveRequestForCalendar,
} from "./DateRangePresets";

// Example 1: Basic Usage
export function BasicExample() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Basic Date Range Picker</h2>
      <DateRangePresets onChange={setDateRange} />

      {dateRange.startDate && dateRange.endDate && (
        <div className="mt-4 p-3 bg-muted rounded-md">
          <p className="text-sm">
            Selected range: {dateRange.startDate} to {dateRange.endDate}
          </p>
        </div>
      )}
    </div>
  );
}

// Example 2: With Leave Requests
export function WithLeaveRequestsExample() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  // Mock leave requests
  const leaveRequests: LeaveRequestForCalendar[] = [
    {
      id: "1",
      startDate: "2025-12-10",
      endDate: "2025-12-12",
      leaveType: "SIL",
      status: "approved_by_hr",
      employeeName: "John Doe",
    },
    {
      id: "2",
      startDate: "2025-12-15",
      endDate: "2025-12-20",
      leaveType: "Maternity Leave",
      status: "approved_by_manager",
      employeeName: "Jane Smith",
    },
    {
      id: "3",
      startDate: "2025-12-08",
      endDate: "2025-12-08",
      leaveType: "LWOP",
      status: "pending",
      employeeName: "Bob Johnson",
    },
  ];

  // Filter leave requests by selected range
  const filteredLeaves = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return leaveRequests;
    }

    return leaveRequests.filter((leave) => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
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
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        Date Range Picker with Leave Requests
      </h2>
      <DateRangePresets onChange={setDateRange} leaveRequests={leaveRequests} />

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">
          Matching Leave Requests ({filteredLeaves.length})
        </h3>
        <div className="space-y-2">
          {filteredLeaves.map((leave) => (
            <div key={leave.id} className="p-3 border rounded-md bg-card">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{leave.employeeName}</p>
                  <p className="text-sm text-muted-foreground">
                    {leave.startDate} to {leave.endDate}
                  </p>
                </div>
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                  {leave.leaveType}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Example 3: With Initial Range
export function WithInitialRangeExample() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: "2025-12-01",
    endDate: "2025-12-31",
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        Date Range Picker with Initial Range
      </h2>
      <DateRangePresets onChange={setDateRange} initialRange={dateRange} />
    </div>
  );
}

// Example 4: Without Calendar
export function WithoutCalendarExample() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        Date Range Picker (No Calendar)
      </h2>
      <DateRangePresets onChange={setDateRange} showCalendar={false} />
    </div>
  );
}

// Example 5: Without Relative Search
export function WithoutRelativeSearchExample() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        Date Range Picker (No Relative Search)
      </h2>
      <DateRangePresets onChange={setDateRange} allowRelativeSearch={false} />
    </div>
  );
}

// Example 6: Integration with Filtering Logic
export function FilteringIntegrationExample() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  // Mock data
  const allData = [
    { id: 1, name: "Item 1", date: "2025-12-10" },
    { id: 2, name: "Item 2", date: "2025-12-15" },
    { id: 3, name: "Item 3", date: "2025-12-20" },
    { id: 4, name: "Item 4", date: "2025-12-25" },
  ];

  // Filter data by date range
  const filteredData = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return allData;
    }

    return allData.filter((item) => {
      const itemDate = new Date(item.date);
      const rangeStart = new Date(dateRange.startDate!);
      const rangeEnd = new Date(dateRange.endDate!);
      return itemDate >= rangeStart && itemDate <= rangeEnd;
    });
  }, [allData, dateRange]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Filtering Integration Example</h2>
      <DateRangePresets onChange={setDateRange} />

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">
          Filtered Items ({filteredData.length} of {allData.length})
        </h3>
        <div className="space-y-2">
          {filteredData.map((item) => (
            <div key={item.id} className="p-3 border rounded-md bg-card">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Example 7: Full Page Integration
export function FullPageExample() {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  const leaveRequests: LeaveRequestForCalendar[] = [
    {
      id: "1",
      startDate: "2025-12-10",
      endDate: "2025-12-12",
      leaveType: "SIL",
      status: "approved_by_hr",
      employeeName: "John Doe",
    },
    {
      id: "2",
      startDate: "2025-12-15",
      endDate: "2025-12-20",
      leaveType: "Maternity Leave",
      status: "approved_by_manager",
      employeeName: "Jane Smith",
    },
  ];

  const filteredLeaves = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return leaveRequests;
    }

    return leaveRequests.filter((leave) => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      const rangeStart = new Date(dateRange.startDate!);
      const rangeEnd = new Date(dateRange.endDate!);

      return (
        (leaveStart >= rangeStart && leaveStart <= rangeEnd) ||
        (leaveEnd >= rangeStart && leaveEnd <= rangeEnd) ||
        (leaveStart <= rangeStart && leaveEnd >= rangeEnd)
      );
    });
  }, [leaveRequests, dateRange]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Leave Request Management</h1>
        <DateRangePresets
          onChange={setDateRange}
          leaveRequests={leaveRequests}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">
          Leave Requests ({filteredLeaves.length})
        </h2>
        <div className="space-y-3">
          {filteredLeaves.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground border rounded-md">
              No leave requests found in the selected date range.
            </div>
          ) : (
            filteredLeaves.map((leave) => (
              <div
                key={leave.id}
                className="p-4 border rounded-md bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{leave.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {leave.startDate} to {leave.endDate}
                    </p>
                    {leave.status && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-muted">
                        {leave.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">
                    {leave.leaveType}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
