/**
 * Overtime Helper
 * 
 * Fetches and combines approved OT requests with regular hours for timesheet
 */

import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

export interface ApprovedOT {
  ot_date: string;
  total_ot_hours: number;
}

/**
 * Get approved OT hours for an employee for a specific date range
 */
export async function getApprovedOT(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, number>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('overtime_requests')
    .select('ot_date, ot_hours')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .gte('ot_date', format(startDate, 'yyyy-MM-dd'))
    .lte('ot_date', format(endDate, 'yyyy-MM-dd'));

  if (error) {
    console.error('Error fetching approved OT:', error);
    return new Map();
  }

  // Group by date and sum hours (in case multiple OT requests per day)
  const otByDate = new Map<string, number>();
  
  (data || []).forEach((ot) => {
    const existing = otByDate.get(ot.ot_date) || 0;
    otByDate.set(ot.ot_date, existing + ot.ot_hours);
  });

  return otByDate;
}

