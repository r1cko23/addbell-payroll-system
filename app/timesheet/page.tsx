'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { determineDayType, getDayName, formatDateShort } from '@/utils/holidays';
import { calculateDailyPay, getDayTypeLabel } from '@/utils/payroll-calculator';
import { formatCurrency } from '@/utils/format';
import type { Holiday } from '@/utils/holidays';
import type { DailyAttendance } from '@/utils/payroll-calculator';

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  rate_per_hour: number;
}

interface DayData {
  date: string;
  dayName: string;
  dayType: string;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  amount: number;
}

export default function TimesheetPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 3 }) // Week starts on Wednesday
  );
  const [weekDays, setWeekDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (holidays.length > 0) {
      initializeWeekDays();
    }
  }, [weekStart, holidays]);

  useEffect(() => {
    if (selectedEmployee && weekDays.length > 0) {
      calculateWeekTotals();
    }
  }, [weekDays, selectedEmployee]);

  async function loadInitialData() {
    try {
      // Load employees
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, rate_per_hour')
        .eq('is_active', true)
        .order('full_name');

      if (empError) throw empError;
      setEmployees(empData || []);

      // Load holidays
      const { data: holidayData, error: holidayError } = await supabase
        .from('holidays')
        .select('holiday_date, holiday_name, holiday_type')
        .eq('year', 2025)
        .eq('is_active', true);

      if (holidayError) throw holidayError;
      
      const formattedHolidays: Holiday[] = (holidayData || []).map((h) => ({
        date: h.holiday_date,
        name: h.holiday_name,
        type: h.holiday_type as 'regular' | 'non-working',
      }));
      
      setHolidays(formattedHolidays);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function initializeWeekDays() {
    const days: DayData[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateString = format(date, 'yyyy-MM-dd');
      const dayType = determineDayType(dateString, holidays);
      
      days.push({
        date: dateString,
        dayName: getDayName(dateString),
        dayType,
        regularHours: 0,
        overtimeHours: 0,
        nightDiffHours: 0,
        amount: 0,
      });
    }
    
    setWeekDays(days);
  }

  function calculateWeekTotals() {
    if (!selectedEmployee) return;
    
    const updatedDays = weekDays.map((day) => {
      const calculation = calculateDailyPay(
        day.dayType as any,
        day.regularHours,
        day.overtimeHours,
        day.nightDiffHours,
        selectedEmployee.rate_per_hour
      );
      
      return { ...day, amount: calculation.total };
    });
    
    setWeekDays(updatedDays);
  }

  function updateDayHours(index: number, field: string, value: string) {
    // Allow empty string for better typing experience
    const numValue = value === '' ? 0 : parseFloat(value);
    const updatedDays = [...weekDays];
    updatedDays[index] = {
      ...updatedDays[index],
      [field]: isNaN(numValue) ? 0 : numValue,
    };
    setWeekDays(updatedDays);
  }

  function changeWeek(direction: 'prev' | 'next') {
    const newWeekStart = addDays(weekStart, direction === 'next' ? 7 : -7);
    setWeekStart(newWeekStart);
  }

  async function handleSave() {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    const hasAnyHours = weekDays.some(
      (day) => day.regularHours > 0 || day.overtimeHours > 0 || day.nightDiffHours > 0
    );

    if (!hasAnyHours) {
      toast.error('Please enter at least some hours');
      return;
    }

    setSaving(true);

    try {
      const attendanceData: DailyAttendance[] = weekDays.map((day) => ({
        date: day.date,
        dayType: day.dayType as any,
        regularHours: day.regularHours,
        overtimeHours: day.overtimeHours,
        nightDiffHours: day.nightDiffHours,
      }));

      const totalRegularHours = weekDays.reduce((sum, d) => sum + d.regularHours, 0);
      const totalOvertimeHours = weekDays.reduce((sum, d) => sum + d.overtimeHours, 0);
      const totalNightDiffHours = weekDays.reduce((sum, d) => sum + d.nightDiffHours, 0);
      const grossPay = weekDays.reduce((sum, d) => sum + d.amount, 0);

      const weekEndDate = addDays(weekStart, 6);

      // Check if attendance already exists
      const { data: existingData } = await supabase
        .from('weekly_attendance')
        .select('id')
        .eq('employee_id', selectedEmployee.id)
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
        .single();

      if (existingData) {
        // Update existing
        const { error } = await supabase
          .from('weekly_attendance')
          .update({
            attendance_data: attendanceData,
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            total_night_diff_hours: totalNightDiffHours,
            gross_pay: grossPay,
          })
          .eq('id', existingData.id);

        if (error) throw error;
        toast.success('Timesheet updated successfully');
      } else {
        // Create new
        const { error } = await supabase.from('weekly_attendance').insert([
          {
            employee_id: selectedEmployee.id,
            week_start_date: format(weekStart, 'yyyy-MM-dd'),
            week_end_date: format(weekEndDate, 'yyyy-MM-dd'),
            attendance_data: attendanceData,
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            total_night_diff_hours: totalNightDiffHours,
            gross_pay: grossPay,
          },
        ]);

        if (error) throw error;
        toast.success('Timesheet saved successfully');
      }

      // Clear form
      initializeWeekDays();
    } catch (error: any) {
      console.error('Error saving timesheet:', error);
      toast.error(error.message || 'Failed to save timesheet');
    } finally {
      setSaving(false);
    }
  }

  async function loadExistingTimesheet() {
    if (!selectedEmployee) return;

    try {
      const { data, error } = await supabase
        .from('weekly_attendance')
        .select('*')
        .eq('employee_id', selectedEmployee.id)
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
        .maybeSingle();

      if (error) throw error;

      if (data && data.attendance_data) {
        const loadedData = data.attendance_data as any[];
        const updatedDays = weekDays.map((day, index) => {
          const savedDay = loadedData[index];
          if (savedDay) {
            return {
              ...day,
              regularHours: savedDay.regularHours || 0,
              overtimeHours: savedDay.overtimeHours || 0,
              nightDiffHours: savedDay.nightDiffHours || 0,
            };
          }
          return day;
        });
        setWeekDays(updatedDays);
        toast.success('Loaded existing timesheet');
      }
    } catch (error) {
      console.error('Error loading timesheet:', error);
    }
  }

  useEffect(() => {
    if (selectedEmployee && weekDays.length > 0) {
      loadExistingTimesheet();
    }
  }, [selectedEmployee, weekStart]);

  const weekTotal = weekDays.reduce((sum, day) => sum + day.amount, 0);
  const totalRegular = weekDays.reduce((sum, day) => sum + day.regularHours, 0);
  const totalOT = weekDays.reduce((sum, day) => sum + day.overtimeHours, 0);
  const totalNightDiff = weekDays.reduce((sum, day) => sum + day.nightDiffHours, 0);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner size="lg" className="mt-20" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Weekly Timesheet Entry</h1>
          <p className="text-gray-600 mt-1">
            Enter hours for the week (Wednesday to Tuesday) - system auto-calculates everything!
          </p>
        </div>

        {/* Controls */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Week
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => changeWeek('prev')}>
                  ← Prev
                </Button>
                <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg px-4 py-2">
                  <span className="font-semibold">
                    {format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd, yyyy')}
                  </span>
                </div>
                <Button variant="secondary" onClick={() => changeWeek('next')}>
                  Next →
                </Button>
              </div>
            </div>

            <div className="md:col-span-2">
              <Select
                label="Select Employee"
                options={[
                  { value: '', label: '-- Select Employee --' },
                  ...employees.map((emp) => ({
                    value: emp.id,
                    label: `${emp.full_name} (${emp.employee_id})`,
                  })),
                ]}
                value={selectedEmployee?.id || ''}
                onChange={(e) => {
                  const emp = employees.find((emp) => emp.id === e.target.value);
                  setSelectedEmployee(emp || null);
                }}
              />
            </div>
          </div>
        </Card>

        {selectedEmployee && (
          <Card title="Weekly Hours Entry">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Day
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Day Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Regular Hrs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Overtime Hrs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Night Diff Hrs
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weekDays.map((day, index) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {day.dayName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDateShort(day.date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            day.dayType === 'regular-holiday' || day.dayType === 'sunday-regular-holiday'
                              ? 'bg-red-100 text-red-800'
                              : day.dayType === 'non-working-holiday' ||
                                day.dayType === 'sunday-special-holiday'
                              ? 'bg-yellow-100 text-yellow-800'
                              : day.dayType === 'sunday'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {getDayTypeLabel(day.dayType as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={day.regularHours === 0 ? '' : day.regularHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, 'regularHours', val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={day.overtimeHours === 0 ? '' : day.overtimeHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, 'overtimeHours', val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={day.nightDiffHours === 0 ? '' : day.nightDiffHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, 'nightDiffHours', val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(day.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary-50 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-sm text-right">
                      WEEKLY TOTALS →
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{totalRegular.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{totalOT.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{totalNightDiff.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-primary-700">
                      {formatCurrency(weekTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={initializeWeekDays}>
                Clear All
              </Button>
              <Button onClick={handleSave} isLoading={saving}>
                Save Timesheet
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

