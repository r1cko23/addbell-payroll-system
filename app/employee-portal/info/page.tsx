'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { createClient } from '@/lib/supabase/client';
import { useEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { format } from 'date-fns';

interface EmployeeInfo {
  employee_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  middle_initial: string | null;
  assigned_hotel: string | null;
  assigned_locations: string[];
  address: string | null;
  birth_date: string | null;
  tin_number: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  hmo_provider: string | null;
  is_active: boolean;
  created_at: string;
}

export default function EmployeeInfoPage() {
  const { employee } = useEmployeeSession();
  const supabase = createClient();
  const [info, setInfo] = useState<EmployeeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fallbackInfo = useMemo<EmployeeInfo>(
    () => ({
      employee_id: employee.employee_id,
      full_name: employee.full_name,
      first_name: null,
      last_name: null,
      middle_initial: null,
      assigned_hotel: null,
      assigned_locations: [],
      address: null,
      birth_date: null,
      tin_number: null,
      sss_number: null,
      philhealth_number: null,
      pagibig_number: null,
      hmo_provider: null,
      is_active: true,
      created_at: employee.loginTime,
    }),
    [employee.employee_id, employee.full_name, employee.loginTime]
  );

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const { data, error } = await supabase.rpc('get_employee_profile', {
          p_employee_uuid: employee.id,
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setInfo(data[0] as EmployeeInfo);
        } else {
          setInfo(fallbackInfo);
          setErrorMessage('We could not find your HR profile, so we are showing the basic information from your session.');
        }
      } catch (err) {
        console.error('Failed to load employee info:', err);
        setInfo(fallbackInfo);
        setErrorMessage('Unable to load the HR record right now. Showing the information we have on file.');
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [employee.id, fallbackInfo, supabase]);

  if (loading || !info) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const rows = [
    { label: 'Employee ID', value: info.employee_id },
    { label: 'Full Name', value: info.full_name },
    { label: 'First Name', value: info.first_name || '—' },
    { label: 'Last Name', value: info.last_name || '—' },
    { label: 'Middle Initial', value: info.middle_initial || '—' },
    { label: 'Address', value: info.address || '—' },
    {
      label: 'Birth Date',
      value: info.birth_date ? format(new Date(info.birth_date), 'MMMM d, yyyy') : '—',
    },
    { label: 'TIN #', value: info.tin_number || '—' },
    { label: 'SSS #', value: info.sss_number || '—' },
    { label: 'PhilHealth #', value: info.philhealth_number || '—' },
    { label: 'Pag-IBIG #', value: info.pagibig_number || '—' },
    { label: 'HMO', value: info.hmo_provider || '—' },
    {
      label: 'Assigned Locations',
      value: info.assigned_locations.length ? info.assigned_locations.join(', ') : '—',
    },
    { label: 'Status', value: info.is_active ? 'Active' : 'Inactive' },
    { label: 'Date Added', value: format(new Date(info.created_at), 'MMMM d, yyyy') },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Employee Information</h2>
          <p className="text-sm text-gray-500">Details registered by HR</p>
        </div>
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {errorMessage}
          </div>
        )}
        <dl className="divide-y divide-gray-200">
          {rows.map((row) => (
            <div key={row.label} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-sm font-medium text-gray-500">{row.label}</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-900 text-sm">
        <p className="font-semibold mb-1">Need to update something?</p>
        <p>Contact your HR representative to request changes to your profile.</p>
      </Card>
    </div>
  );
}

