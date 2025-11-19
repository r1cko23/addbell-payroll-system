'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, parseISO, subWeeks } from 'date-fns';
import { determineDayType, getDayName, formatDateShort } from '@/utils/holidays';
import { calculateDailyPay, getDayTypeLabel } from '@/utils/payroll-calculator';
import { formatCurrency } from '@/utils/format';
import type { Holiday } from '@/utils/holidays';
import type { DailyAttendance } from '@/utils/payroll-calculator';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

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
  regularHours: number | string;
  overtimeHours: number | string;
  nightDiffHours: number | string;
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

  // Calculate totals on demand when needed (removed auto-calculation to prevent infinite loop)

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
      // Convert string values to numbers for calculation
      const regHours = typeof day.regularHours === 'string' ? parseFloat(day.regularHours) || 0 : day.regularHours;
      const otHours = typeof day.overtimeHours === 'string' ? parseFloat(day.overtimeHours) || 0 : day.overtimeHours;
      const ndHours = typeof day.nightDiffHours === 'string' ? parseFloat(day.nightDiffHours) || 0 : day.nightDiffHours;
      
      const calculation = calculateDailyPay(
        day.dayType as any,
        regHours,
        otHours,
        ndHours,
        selectedEmployee.rate_per_hour
      );
      
      return { ...day, amount: calculation.total };
    });
    
    setWeekDays(updatedDays);
  }

  function updateDayHours(index: number, field: string, value: string) {
    if (!selectedEmployee) return;
    
    // Store string as-is to allow smooth typing
    const updatedDays = [...weekDays];
    updatedDays[index] = {
      ...updatedDays[index],
      [field]: value,
    };
    
    // Calculate amount for this specific day
    const day = updatedDays[index];
    const regHours = typeof day.regularHours === 'string' ? parseFloat(day.regularHours) || 0 : day.regularHours;
    const otHours = typeof day.overtimeHours === 'string' ? parseFloat(day.overtimeHours) || 0 : day.overtimeHours;
    const ndHours = typeof day.nightDiffHours === 'string' ? parseFloat(day.nightDiffHours) || 0 : day.nightDiffHours;
    
    const calculation = calculateDailyPay(
      day.dayType as any,
      regHours,
      otHours,
      ndHours,
      selectedEmployee.rate_per_hour
    );
    
    updatedDays[index].amount = calculation.total;
    
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

    // Convert string values to numbers for validation and saving
    const toNumber = (val: string | number) => typeof val === 'string' ? parseFloat(val) || 0 : val;

    const hasAnyHours = weekDays.some(
      (day) => toNumber(day.regularHours) > 0 || toNumber(day.overtimeHours) > 0 || toNumber(day.nightDiffHours) > 0
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
        regularHours: toNumber(day.regularHours),
        overtimeHours: toNumber(day.overtimeHours),
        nightDiffHours: toNumber(day.nightDiffHours),
      }));

      const totalRegularHours = weekDays.reduce((sum, d) => sum + toNumber(d.regularHours), 0);
      const totalOvertimeHours = weekDays.reduce((sum, d) => sum + toNumber(d.overtimeHours), 0);
      const totalNightDiffHours = weekDays.reduce((sum, d) => sum + toNumber(d.nightDiffHours), 0);
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

  async function copyLastWeek() {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }

    const lastWeekStart = subWeeks(weekStart, 1);

    try {
      const { data, error } = await supabase
        .from('weekly_attendance')
        .select('*')
        .eq('employee_id', selectedEmployee.id)
        .eq('week_start_date', format(lastWeekStart, 'yyyy-MM-dd'))
        .maybeSingle();

      if (error) throw error;

      if (!data || !data.attendance_data) {
        toast.error(`No timesheet found for week of ${format(lastWeekStart, 'MMM d, yyyy')}`);
        return;
      }

      // Map last week's data to current week
      const lastWeekData = data.attendance_data as DailyAttendance[];
      const updatedDays = weekDays.map((currentDay, index) => {
        const lastWeekDay = lastWeekData[index];
        if (lastWeekDay) {
          const calculation = calculateDailyPay(
            currentDay.dayType as any,
            lastWeekDay.regularHours,
            lastWeekDay.overtimeHours,
            lastWeekDay.nightDiffHours,
            selectedEmployee.rate_per_hour
          );

          return {
            ...currentDay,
            regularHours: lastWeekDay.regularHours,
            overtimeHours: lastWeekDay.overtimeHours,
            nightDiffHours: lastWeekDay.nightDiffHours,
            amount: calculation.total,
          };
        }
        return currentDay;
      });

      setWeekDays(updatedDays);
      toast.success('✅ Copied last week\'s hours! Review and save when ready.');
    } catch (error) {
      console.error('Error copying last week:', error);
      toast.error('Failed to copy last week\'s data');
    }
  }

  function applyStandardWeek() {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }

    // Apply 8 hours to all days except Sunday (index 4)
    // Week: Wed(0), Thu(1), Fri(2), Sat(3), Sun(4), Mon(5), Tue(6)
    const updatedDays = weekDays.map((day, index) => {
      const isWorkDay = index !== 4; // All days except Sunday
      const regularHours = isWorkDay ? 8 : 0;

      const calculation = calculateDailyPay(
        day.dayType as any,
        regularHours,
        0,
        0,
        selectedEmployee.rate_per_hour
      );

      return {
        ...day,
        regularHours,
        overtimeHours: 0,
        nightDiffHours: 0,
        amount: calculation.total,
      };
    });

    setWeekDays(updatedDays);
    toast.success('✅ Applied standard 6-day week (8hrs Wed-Sat, Mon-Tue)');
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
            const regularHours = savedDay.regularHours || 0;
            const overtimeHours = savedDay.overtimeHours || 0;
            const nightDiffHours = savedDay.nightDiffHours || 0;
            
            // Calculate amount for loaded data
            const calculation = calculateDailyPay(
              day.dayType as any,
              regularHours,
              overtimeHours,
              nightDiffHours,
              selectedEmployee.rate_per_hour
            );
            
            return {
              ...day,
              regularHours,
              overtimeHours,
              nightDiffHours,
              amount: calculation.total,
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

  // Helper to convert string or number to number
  const toNum = (val: string | number) => typeof val === 'string' ? parseFloat(val) || 0 : val;
  
  const weekTotal = weekDays.reduce((sum, day) => sum + day.amount, 0);
  const totalRegular = weekDays.reduce((sum, day) => sum + toNum(day.regularHours), 0);
  const totalOT = weekDays.reduce((sum, day) => sum + toNum(day.overtimeHours), 0);
  const totalNightDiff = weekDays.reduce((sum, day) => sum + toNum(day.nightDiffHours), 0);

  // Validation warnings
  const warnings: string[] = [];
  weekDays.forEach((day) => {
    const reg = toNum(day.regularHours);
    const ot = toNum(day.overtimeHours);
    const nd = toNum(day.nightDiffHours);
    const total = reg + ot + nd;

    if (total > 16) {
      warnings.push(`⚠️ ${day.dayName} (${formatDateShort(day.date)}): ${total} total hours exceeds 16 (possible duplicate entry?)`);
    } else if (ot > 8) {
      warnings.push(`⚠️ ${day.dayName} (${formatDateShort(day.date)}): ${ot} OT hours is unusually high`);
    }
  });

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

        <Card>
          <div className="space-y-4">
            {/* Week Navigation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Week (Wednesday - Tuesday)
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => changeWeek('prev')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center">
                  <div className="font-semibold text-gray-900">
                    {format(weekStart, 'MMM d, yyyy')} -{' '}
                    {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                  </div>
                  <div className="text-sm text-gray-500">
                    Week of {format(weekStart, 'MMMM d, yyyy')}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => changeWeek('next')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Employee Selection */}
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
        </Card>

        {selectedEmployee && (
          <Card title="Weekly Hours Entry">
            {/* Validation Warnings */}
            {warnings.length > 0 && (
              <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Validation Warnings ({warnings.length})
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <ul className="list-disc pl-5 space-y-1">
                        {warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-2 text-xs text-yellow-600">
                      💡 These are just warnings. Review the data and save if correct.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                          value={day.regularHours || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty, numbers, and decimals
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, 'regularHours', val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-center"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={day.overtimeHours || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty, numbers, and decimals
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, 'overtimeHours', val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-center"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={day.nightDiffHours || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty, numbers, and decimals
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, 'nightDiffHours', val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-center"
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

            {/* Quick Fill Templates */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">⚡ Quick Fill Templates</h4>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={applyStandardWeek}
                >
                  📅 Standard Week (8hrs, Sunday off)
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={copyLastWeek}
                >
                  📋 Copy Last Week
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={initializeWeekDays}
                >
                  🗑️ Clear All
                </Button>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                💡 Tip: Use templates to speed up entry, then adjust individual days as needed
              </p>
            </div>

            {/* Save Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <Button onClick={handleSave} isLoading={saving}>
                💾 Save Timesheet
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

