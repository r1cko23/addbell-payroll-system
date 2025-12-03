'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input, Select } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/format';
import { format, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  getBiMonthlyPeriodStart, 
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod
} from '@/utils/bimonthly';
// import { calculateAllContributions } from '@/utils/ph-deductions';

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

interface Deductions {
  id?: string;
  employee_id: string;
  period_start: string;
  period_end?: string;
  vale_amount: number;
  uniform_ppe_amount: number;
  sss_salary_loan: number;
  sss_calamity_loan: number;
  pagibig_salary_loan: number;
  pagibig_calamity_loan: number;
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
}

export default function DeductionsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [periodStart, setPeriodStart] = useState<Date>(() => getBiMonthlyPeriodStart(new Date()));
  const [deductions, setDeductions] = useState<Deductions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vale_amount: '0',
    uniform_ppe_amount: '0',
    sss_salary_loan: '0',
    sss_calamity_loan: '0',
    pagibig_salary_loan: '0',
    pagibig_calamity_loan: '0',
    sss_contribution: '0',
    philhealth_contribution: '0',
    pagibig_contribution: '0',
    withholding_tax: '0',
  });

  const supabase = createClient();

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadDeductions();
      // Auto-calculation disabled as rate_per_day is removed
      // autoCalculateContributions();
    }
  }, [selectedEmployeeId, periodStart]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_id, full_name')
        .eq('is_active', true)
        .order('last_name', { nullsFirst: false })
        .order('first_name', { nullsFirst: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  // function autoCalculateContributions() {
  //   if (!selectedEmployeeId) return;
  //   
  //   const employee = employees.find(emp => emp.id === selectedEmployeeId);
  //   if (!employee || !employee.rate_per_day) return;
  //
  //   // Calculate contributions based on daily rate
  //   const contributions = calculateAllContributions(employee.rate_per_day, 22); // 22 working days per month
  //   
  //   // Update form data with calculated bi-monthly contributions
  //   setFormData(prev => ({
  //     ...prev,
  //     sss_contribution: contributions.biMonthly.sss.toFixed(2),
  //     philhealth_contribution: contributions.biMonthly.philhealth.toFixed(2),
  //     pagibig_contribution: contributions.biMonthly.pagibig.toFixed(2),
  //   }));
  // }

  async function loadDeductions() {
    try {
      const periodStartStr = format(periodStart, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('employee_deductions')
        .select('*')
        .eq('employee_id', selectedEmployeeId)
        .eq('period_start', periodStartStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDeductions(data);
        setFormData({
          vale_amount: data.vale_amount.toString(),
          uniform_ppe_amount: data.uniform_ppe_amount.toString(),
          sss_salary_loan: data.sss_salary_loan.toString(),
          sss_calamity_loan: data.sss_calamity_loan.toString(),
          pagibig_salary_loan: data.pagibig_salary_loan.toString(),
          pagibig_calamity_loan: data.pagibig_calamity_loan.toString(),
          sss_contribution: data.sss_contribution.toString(),
          philhealth_contribution: data.philhealth_contribution.toString(),
          pagibig_contribution: data.pagibig_contribution.toString(),
          withholding_tax: data.withholding_tax.toString(),
        });
      } else {
        setDeductions(null);
        resetForm();
        // Auto-calculate contributions for new record
        // autoCalculateContributions();
      }
    } catch (error) {
      console.error('Error loading deductions:', error);
      toast.error('Failed to load deductions');
    }
  }

  function resetForm() {
    setFormData({
      vale_amount: '0',
      uniform_ppe_amount: '0',
      sss_salary_loan: '0',
      sss_calamity_loan: '0',
      pagibig_salary_loan: '0',
      pagibig_calamity_loan: '0',
      sss_contribution: '0',
      philhealth_contribution: '0',
      pagibig_contribution: '0',
      withholding_tax: '0',
    });
  }

  async function handleSave() {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    setSaving(true);

    try {
      const periodStartStr = format(periodStart, 'yyyy-MM-dd');
      const periodEnd = getBiMonthlyPeriodEnd(periodStart);
      const periodEndStr = format(periodEnd, 'yyyy-MM-dd');
      
      const deductionData = {
        employee_id: selectedEmployeeId,
        period_start: periodStartStr,
        period_end: periodEndStr,
        period_type: 'bimonthly',
        vale_amount: parseFloat(formData.vale_amount) || 0,
        uniform_ppe_amount: parseFloat(formData.uniform_ppe_amount) || 0,
        sss_salary_loan: parseFloat(formData.sss_salary_loan) || 0,
        sss_calamity_loan: parseFloat(formData.sss_calamity_loan) || 0,
        pagibig_salary_loan: parseFloat(formData.pagibig_salary_loan) || 0,
        pagibig_calamity_loan: parseFloat(formData.pagibig_calamity_loan) || 0,
        sss_contribution: parseFloat(formData.sss_contribution) || 0,
        philhealth_contribution: parseFloat(formData.philhealth_contribution) || 0,
        pagibig_contribution: parseFloat(formData.pagibig_contribution) || 0,
        withholding_tax: parseFloat(formData.withholding_tax) || 0,
      };

      if (deductions?.id) {
        // Update existing
        const { error } = await supabase
          .from('employee_deductions')
          .update(deductionData)
          .eq('id', deductions.id);

        if (error) throw error;
        toast.success(`Deductions updated for period ${formatBiMonthlyPeriod(periodStart, periodEnd)}`);
      } else {
        // Create new
        const { error } = await supabase
          .from('employee_deductions')
          .insert([deductionData]);

        if (error) throw error;
        toast.success(`Deductions saved for period ${formatBiMonthlyPeriod(periodStart, periodEnd)}`);
      }

      loadDeductions();
    } catch (error: any) {
      console.error('Error saving deductions:', error);
      toast.error(error.message || 'Failed to save deductions');
    } finally {
      setSaving(false);
    }
  }

  const weeklyTotal =
    parseFloat(formData.vale_amount || '0') +
    parseFloat(formData.uniform_ppe_amount || '0') +
    parseFloat(formData.sss_salary_loan || '0') +
    parseFloat(formData.sss_calamity_loan || '0') +
    parseFloat(formData.pagibig_salary_loan || '0') +
    parseFloat(formData.pagibig_calamity_loan || '0');

  const govTotal =
    parseFloat(formData.sss_contribution || '0') +
    parseFloat(formData.philhealth_contribution || '0') +
    parseFloat(formData.pagibig_contribution || '0');

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
          <h1 className="text-3xl font-bold text-gray-900">Deductions Management</h1>
          <p className="text-gray-600 mt-1">
            Configure bi-monthly deductions and government contributions per employee
          </p>
        </div>

        <Card>
          <div className="space-y-4">
            {/* Period Navigation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bi-Monthly Period (Monday - Friday, 2 weeks)
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPeriodStart(getPreviousBiMonthlyPeriod(periodStart))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center">
                  <div className="font-semibold text-gray-900">
                    {formatBiMonthlyPeriod(periodStart, getBiMonthlyPeriodEnd(periodStart))}
                  </div>
                  <div className="text-sm text-gray-500">
                    Period starting {format(periodStart, 'MMMM d, yyyy')}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPeriodStart(getNextBiMonthlyPeriod(periodStart))}
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
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            />
          </div>
        </Card>

        {selectedEmployeeId && (
          <>
            <Card 
              title="Bi-Monthly Deductions" 
              subtitle={`For period ${formatBiMonthlyPeriod(periodStart, getBiMonthlyPeriodEnd(periodStart))}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Vale"
                  type="number"
                  step="0.01"
                  value={formData.vale_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, vale_amount: e.target.value })
                  }
                  helperText="Cash advance deduction"
                />

                <Input
                  label="Uniform / PPE"
                  type="number"
                  step="0.01"
                  value={formData.uniform_ppe_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, uniform_ppe_amount: e.target.value })
                  }
                  helperText="Uniform or safety equipment"
                />

                <Input
                  label="SSS Salary Loan"
                  type="number"
                  step="0.01"
                  value={formData.sss_salary_loan}
                  onChange={(e) =>
                    setFormData({ ...formData, sss_salary_loan: e.target.value })
                  }
                />

                <Input
                  label="SSS Calamity Loan"
                  type="number"
                  step="0.01"
                  value={formData.sss_calamity_loan}
                  onChange={(e) =>
                    setFormData({ ...formData, sss_calamity_loan: e.target.value })
                  }
                />

                <Input
                  label="Pag-IBIG Salary Loan"
                  type="number"
                  step="0.01"
                  value={formData.pagibig_salary_loan}
                  onChange={(e) =>
                    setFormData({ ...formData, pagibig_salary_loan: e.target.value })
                  }
                />

                <Input
                  label="Pag-IBIG Calamity Loan"
                  type="number"
                  step="0.01"
                  value={formData.pagibig_calamity_loan}
                  onChange={(e) =>
                    setFormData({ ...formData, pagibig_calamity_loan: e.target.value })
                  }
                />
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">
                    Total Bi-Monthly Deductions:
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(weeklyTotal)}
                  </span>
                </div>
              </div>
            </Card>

            <Card
              title="Government Contributions"
              subtitle="Manual entry required (rates removed)."
            >
              {/* <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  💡 <strong>Auto-Calculated:</strong> Contributions are automatically calculated based on the employee's daily rate using Philippine salary brackets. You can manually adjust if needed.
                </p>
              </div> */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="SSS Contribution"
                  type="number"
                  step="0.01"
                  value={formData.sss_contribution}
                  onChange={(e) =>
                    setFormData({ ...formData, sss_contribution: e.target.value })
                  }
                  helperText="Bi-monthly amount"
                />

                <Input
                  label="PhilHealth Contribution"
                  type="number"
                  step="0.01"
                  value={formData.philhealth_contribution}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      philhealth_contribution: e.target.value,
                    })
                  }
                  helperText="Bi-monthly amount"
                />

                <Input
                  label="Pag-IBIG Contribution"
                  type="number"
                  step="0.01"
                  value={formData.pagibig_contribution}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pagibig_contribution: e.target.value,
                    })
                  }
                  helperText="Bi-monthly amount"
                />

                <Input
                  label="Withholding Tax"
                  type="number"
                  step="0.01"
                  value={formData.withholding_tax}
                  onChange={(e) =>
                    setFormData({ ...formData, withholding_tax: e.target.value })
                  }
                  helperText="Income tax withheld"
                />
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-blue-700">
                    Total Government Contributions:
                  </span>
                  <span className="text-xl font-bold text-blue-900">
                    {formatCurrency(govTotal)}
                  </span>
                </div>
                <p className="text-sm text-blue-600 mt-2">
                  💡 These will be applied when you check the boxes in the payslip
                  (usually 3rd or 4th week)
                </p>
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={resetForm}>
                Reset
              </Button>
              <Button onClick={handleSave} isLoading={saving}>
                Save Deductions
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
